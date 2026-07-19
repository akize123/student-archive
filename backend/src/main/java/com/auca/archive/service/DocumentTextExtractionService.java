package com.auca.archive.service;

import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.regex.Pattern;

@Service
public class DocumentTextExtractionService {
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9]+");

    private final int minTextCharsBeforeOcr;
    private final int maxOcrPages;
    private final float ocrDpi;
    private final String tessDataPath;
    private final OcrSettingsService ocrSettingsService;

    public DocumentTextExtractionService(
            @Value("${archive.document-scan.min-text-chars:60}") int minTextCharsBeforeOcr,
            @Value("${archive.document-scan.max-ocr-pages:10}") int maxOcrPages,
            @Value("${archive.document-scan.ocr-dpi:150}") float ocrDpi,
            @Value("${archive.ocr.tessdata-path:}") String tessDataPath,
            OcrSettingsService ocrSettingsService
    ) {
        this.minTextCharsBeforeOcr = minTextCharsBeforeOcr;
        this.maxOcrPages = maxOcrPages;
        this.ocrDpi = ocrDpi;
        this.tessDataPath = tessDataPath == null ? "" : tessDataPath.trim();
        this.ocrSettingsService = ocrSettingsService;
    }

    public ExtractionResult extractFromPdf(byte[] fileBytes) throws IOException {
        try (PDDocument document = PDDocument.load(fileBytes)) {
            int pageCount = document.getNumberOfPages();
            String extractedText = extractText(document);
            String scanMethod = "TEXT";

            if (extractedText.length() < minTextCharsBeforeOcr) {
                String ocrText = runOcr(document);
                if (!ocrText.isBlank()) {
                    extractedText = (extractedText + " " + ocrText).trim();
                    scanMethod = extractedText.isBlank() ? "OCR" : "TEXT+OCR";
                } else if (extractedText.isBlank()) {
                    scanMethod = "NONE";
                }
            }

            return new ExtractionResult(normalize(extractedText), pageCount, scanMethod);
        }
    }

    public String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase().replaceAll("\\s+", " ").trim();
    }

    public String normalizeToken(String value) {
        if (value == null) {
            return "";
        }
        return NON_ALPHANUMERIC.matcher(value.toLowerCase()).replaceAll("");
    }

    public String buildPreview(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String compact = text.replaceAll("\\s+", " ").trim();
        return compact.length() <= 220 ? compact : compact.substring(0, 217) + "...";
    }

    public boolean isOcrEnabled() {
        return ocrSettingsService.isEnabled();
    }

    public boolean isOcrAvailable() {
        if (!ocrSettingsService.isEnabled()) {
            return false;
        }
        return createTesseract() != null;
    }

    private String extractText(PDDocument document) throws IOException {
        PDFTextStripper stripper = new PDFTextStripper();
        stripper.setSortByPosition(true);
        return normalize(document.getNumberOfPages() == 0 ? "" : stripper.getText(document));
    }

    private String runOcr(PDDocument document) {
        if (!ocrSettingsService.isEnabled()) {
            return "";
        }
        try {
            Tesseract tesseract = createTesseract();
            if (tesseract == null) {
                return "";
            }
            PDFRenderer renderer = new PDFRenderer(document);
            int pages = Math.min(document.getNumberOfPages(), maxOcrPages);
            StringBuilder builder = new StringBuilder();
            for (int pageIndex = 0; pageIndex < pages; pageIndex++) {
                var image = renderer.renderImageWithDPI(pageIndex, ocrDpi);
                String pageText = tesseract.doOCR(image);
                if (pageText != null && !pageText.isBlank()) {
                    builder.append(' ').append(pageText);
                }
            }
            return normalize(builder.toString());
        } catch (IOException | TesseractException ex) {
            return "";
        }
    }

    private Tesseract createTesseract() {
        try {
            Tesseract tesseract = new Tesseract();
            if (!tessDataPath.isBlank()) {
                tesseract.setDatapath(tessDataPath);
            }
            tesseract.setLanguage("eng");
            return tesseract;
        } catch (Exception ex) {
            return null;
        }
    }

    public record ExtractionResult(String text, int pageCount, String scanMethod) {
    }
}
