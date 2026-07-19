package com.auca.archive.service;

import com.auca.archive.util.FileSignatureValidator;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;

@Service
public class FileConversionService {
    private static final Set<String> ALLOWED_MIME = Set.of(
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    private final String libreOfficePath;
    private final MalwareScanService malwareScanService;

    public FileConversionService(
            @Value("${archive.conversion.libreoffice-path:}") String libreOfficePath,
            MalwareScanService malwareScanService
    ) {
        this.libreOfficePath = libreOfficePath;
        this.malwareScanService = malwareScanService;
    }

    public byte[] normalizeToPdf(byte[] bytes, String mimeType, String fileName) throws IOException {
        malwareScanService.scan(bytes, fileName);
        String normalizedMime = mimeType == null ? "" : mimeType.toLowerCase(Locale.ROOT);
        if (FileSignatureValidator.isPdf(bytes)) {
            return bytes;
        }
        if (normalizedMime.startsWith("image/") || isImageFile(fileName)) {
            return imageToPdf(bytes);
        }
        if (isWordFile(fileName, normalizedMime)) {
            return convertWordToPdf(bytes, fileName);
        }
        throw new IllegalArgumentException("Unsupported file type. Upload PDF or image files.");
    }

    public void requireAllowedMime(String mimeType) {
        if (mimeType == null || mimeType.isBlank()) {
            return;
        }
        if (!ALLOWED_MIME.contains(mimeType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("File type is not allowed: " + mimeType);
        }
    }

    private byte[] imageToPdf(byte[] imageBytes) throws IOException {
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(imageBytes));
        if (image == null) {
            throw new IllegalArgumentException("Unable to read image file.");
        }
        try (PDDocument document = new PDDocument()) {
            PDRectangle pageSize = PDRectangle.A4;
            PDPage page = new PDPage(pageSize);
            document.addPage(page);
            PDImageXObject pdImage = LosslessFactory.createFromImage(document, image);
            float scale = Math.min(
                    pageSize.getWidth() / pdImage.getWidth(),
                    pageSize.getHeight() / pdImage.getHeight()
            );
            float width = pdImage.getWidth() * scale;
            float height = pdImage.getHeight() * scale;
            float x = (pageSize.getWidth() - width) / 2f;
            float y = (pageSize.getHeight() - height) / 2f;
            try (PDPageContentStream contentStream = new PDPageContentStream(document, page)) {
                contentStream.drawImage(pdImage, x, y, width, height);
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            document.save(output);
            return output.toByteArray();
        }
    }

    private byte[] convertWordToPdf(byte[] bytes, String fileName) throws IOException {
        if (libreOfficePath == null || libreOfficePath.isBlank()) {
            throw new IllegalArgumentException("Word conversion is unavailable. Install LibreOffice or upload a PDF.");
        }
        Path tempDir = Files.createTempDirectory("auca-convert-");
        try {
            Path input = tempDir.resolve(sanitize(fileName));
            Files.write(input, bytes);
            Process process = new ProcessBuilder(
                    libreOfficePath,
                    "--headless",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    tempDir.toString(),
                    input.toString()
            ).start();
            int exit = process.waitFor();
            if (exit != 0) {
                throw new IllegalArgumentException("Unable to convert document to PDF.");
            }
            Path pdfPath = tempDir.resolve(stripExtension(sanitize(fileName)) + ".pdf");
            return Files.readAllBytes(pdfPath);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalArgumentException("Document conversion was interrupted.");
        } finally {
            try (var paths = Files.walk(tempDir)) {
                paths.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException ignored) {
                    }
                });
            }
        }
    }

    private boolean isImageFile(String fileName) {
        String lower = String.valueOf(fileName).toLowerCase(Locale.ROOT);
        return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp");
    }

    private boolean isWordFile(String fileName, String mimeType) {
        String lower = String.valueOf(fileName).toLowerCase(Locale.ROOT);
        return lower.endsWith(".doc") || lower.endsWith(".docx")
                || mimeType.contains("word");
    }

    private String sanitize(String fileName) {
        return String.valueOf(fileName).replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String stripExtension(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot > 0 ? fileName.substring(0, dot) : fileName;
    }
}
