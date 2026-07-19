package com.auca.archive.service;

import com.auca.archive.model.DocumentEntity;
import com.auca.archive.repository.DocumentRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;

@Service
public class PdfOptimizationService {
    private final DocumentRepository documentRepository;
    private final FileEncryptionService fileEncryptionService;

    public PdfOptimizationService(
            DocumentRepository documentRepository,
            FileEncryptionService fileEncryptionService
    ) {
        this.documentRepository = documentRepository;
        this.fileEncryptionService = fileEncryptionService;
    }

    @Async
    public void optimizeDocumentAsync(Long documentId) {
        documentRepository.findById(documentId).ifPresent(document -> {
            try {
                optimizeDocument(document);
            } catch (IOException ignored) {
                // Compression is best-effort and should not block uploads.
            }
        });
    }

    public byte[] compressPdf(byte[] input) throws IOException {
        try (PDDocument document = PDDocument.load(input);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            document.setAllSecurityToBeRemoved(true);
            document.save(output);
            return output.toByteArray();
        }
    }

    public void compressFileInPlace(Path path) throws IOException {
        byte[] original = Files.readAllBytes(path);
        byte[] compressed = compressPdf(original);
        if (compressed.length < original.length) {
            Files.write(path, compressed);
        }
    }

    private void optimizeDocument(DocumentEntity document) throws IOException {
        if (document.getFilePath() == null || document.getFilePath().isBlank()) {
            return;
        }
        Path path = Path.of(document.getFilePath());
        if (!Files.exists(path)) {
            return;
        }

        byte[] stored = Files.readAllBytes(path);
        byte[] decrypted = Boolean.TRUE.equals(document.getEncrypted())
                ? fileEncryptionService.decrypt(stored, document.getEncryptionIv())
                : stored;
        byte[] compressed = compressPdf(decrypted);
        if (compressed.length >= decrypted.length) {
            return;
        }

        byte[] rewritten;
        if (Boolean.TRUE.equals(document.getEncrypted())) {
            FileEncryptionService.EncryptedPayload encrypted = fileEncryptionService.encrypt(compressed);
            rewritten = encrypted.bytes();
            document.setEncryptionIv(encrypted.ivBase64());
        } else {
            rewritten = compressed;
        }
        Files.write(path, rewritten);
        document.setCompressed(Boolean.TRUE);
        document.setSizeBytes((long) compressed.length);
        document.setModifiedAt(LocalDateTime.now());
        documentRepository.save(document);
    }
}
