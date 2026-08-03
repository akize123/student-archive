package com.auca.archive.service;

import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.DocumentTemplateResponse;
import com.auca.archive.dto.UpdateDocumentTemplateRequest;
import com.auca.archive.model.DocumentTemplateEntity;
import com.auca.archive.repository.DocumentTemplateRepository;
import com.auca.archive.util.FileSignatureValidator;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class DocumentTemplateService {
    private final DocumentTemplateRepository repository;
    private final DocumentTextExtractionService textExtractionService;
    private final FileEncryptionService fileEncryptionService;
    private final ArchiveAccessService accessService;
    private final Path storageRoot;

    public DocumentTemplateService(
            DocumentTemplateRepository repository,
            DocumentTextExtractionService textExtractionService,
            FileEncryptionService fileEncryptionService,
            ArchiveAccessService accessService,
            @Value("${archive.storage-root:storage}") String storageRoot
    ) {
        this.repository = repository;
        this.textExtractionService = textExtractionService;
        this.fileEncryptionService = fileEncryptionService;
        this.accessService = accessService;
        this.storageRoot = Path.of(storageRoot);
    }

    public List<DocumentTemplateResponse> list(
            String rawRole,
            StudentDocumentCategory category,
            String office,
            String faculty,
            String department
    ) {
        accessService.resolveRole(rawRole);
        return repository.findByActiveTrueOrderByTitleAsc().stream()
                .filter(entity -> category == null || entity.getCategory() == category)
                .filter(entity -> matchesOptional(entity.getOffice(), office))
                .filter(entity -> matchesOptional(entity.getFaculty(), faculty))
                .filter(entity -> matchesOptional(entity.getDepartment(), department))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public DocumentTemplateResponse upload(
            MultipartFile file,
            StudentDocumentCategory category,
            String documentTypeName,
            String office,
            String faculty,
            String department,
            String title,
            Integer similarityThreshold,
            String rawRole,
            String rawAccountId
    ) throws IOException {
        UserRole role = accessService.resolveRole(rawRole);
        requireManageRole(role);
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Template PDF file is required");
        }
        if (documentTypeName == null || documentTypeName.isBlank()) {
            throw new IllegalArgumentException("Document type name is required");
        }
        if (office == null || office.isBlank()) {
            throw new IllegalArgumentException("Office is required");
        }

        byte[] fileBytes = file.getBytes();
        FileSignatureValidator.requirePdf(fileBytes);

        String normalizedTypeName = documentTypeName.trim();
        String normalizedOffice = office.trim();
        String normalizedFaculty = normalizeOptional(faculty);
        String normalizedDepartment = normalizeOptional(department);

        DocumentTextExtractionService.ExtractionResult extraction = textExtractionService.extractFromPdf(fileBytes);
        if (extraction.text().isBlank()) {
            throw new IllegalArgumentException("Could not extract any text from the template PDF. Enable OCR if this is a scanned PDF.");
        }

        deactivateExisting(category, normalizedTypeName, normalizedOffice, normalizedFaculty, normalizedDepartment);

        Path templateRoot = storageRoot.resolve("templates");
        Files.createDirectories(templateRoot);
        String storedName = UUID.randomUUID() + "_template.pdf";
        Path target = templateRoot.resolve(storedName);
        FileEncryptionService.EncryptedPayload encrypted = fileEncryptionService.encrypt(fileBytes);
        Files.write(target, encrypted.bytes(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        DocumentTemplateEntity entity = new DocumentTemplateEntity();
        entity.setCategory(category);
        entity.setDocumentTypeName(normalizedTypeName);
        entity.setOffice(normalizedOffice);
        entity.setFaculty(normalizedFaculty);
        entity.setDepartment(normalizedDepartment);
        entity.setTitle(title == null || title.isBlank()
                ? normalizedTypeName + " Template"
                : title.trim());
        entity.setFilePath(target.toString());
        entity.setEncryptionIv(encrypted.ivBase64());
        entity.setBaselineText(extraction.text());
        entity.setBaselineTextHash(hashText(extraction.text()));
        entity.setPageCount(extraction.pageCount());
        entity.setOcrMethod(extraction.scanMethod());
        entity.setSimilarityThreshold(similarityThreshold == null || similarityThreshold < 1 ? 80 : similarityThreshold);
        entity.setActive(Boolean.TRUE);
        entity.setUploadedByAccountId(parseAccountId(rawAccountId));
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public DocumentTemplateResponse update(Long id, UpdateDocumentTemplateRequest request, String rawRole) {
        UserRole role = accessService.resolveRole(rawRole);
        requireManageRole(role);
        DocumentTemplateEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Document template not found: " + id));
        if (request.title() != null && !request.title().isBlank()) {
            entity.setTitle(request.title().trim());
        }
        if (request.similarityThreshold() != null && request.similarityThreshold() > 0) {
            entity.setSimilarityThreshold(request.similarityThreshold());
        }
        if (request.active() != null) {
            entity.setActive(request.active());
        }
        entity.setUpdatedAt(LocalDateTime.now());
        return toResponse(repository.save(entity));
    }

    public String previewText(Long id, String rawRole) {
        accessService.resolveRole(rawRole);
        DocumentTemplateEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Document template not found: " + id));
        return textExtractionService.buildPreview(entity.getBaselineText());
    }

    public Optional<DocumentTemplateEntity> findActiveTemplate(
            StudentDocumentCategory category,
            String office,
            String faculty,
            String department
    ) {
        if (category == null) {
            return Optional.empty();
        }
        List<DocumentTemplateEntity> active = repository.findByActiveTrueOrderByTitleAsc().stream()
                .filter(entity -> entity.getCategory() == category)
                .toList();

        Optional<DocumentTemplateEntity> exact = active.stream()
                .filter(entity -> matchesOptional(entity.getOffice(), office))
                .filter(entity -> matchesOptional(entity.getFaculty(), faculty))
                .filter(entity -> matchesOptional(entity.getDepartment(), department))
                .findFirst();
        if (exact.isPresent()) {
            return exact;
        }

        Optional<DocumentTemplateEntity> officeDepartment = active.stream()
                .filter(entity -> matchesOptional(entity.getOffice(), office))
                .filter(entity -> matchesOptional(entity.getDepartment(), department))
                .filter(entity -> entity.getFaculty() == null || entity.getFaculty().isBlank())
                .findFirst();
        if (officeDepartment.isPresent()) {
            return officeDepartment;
        }

        Optional<DocumentTemplateEntity> officeOnly = active.stream()
                .filter(entity -> matchesOptional(entity.getOffice(), office))
                .filter(entity -> (entity.getFaculty() == null || entity.getFaculty().isBlank())
                        && (entity.getDepartment() == null || entity.getDepartment().isBlank()))
                .findFirst();
        if (officeOnly.isPresent()) {
            return officeOnly;
        }

        return active.stream()
                .filter(entity -> (entity.getOffice() == null || entity.getOffice().isBlank())
                        && (entity.getFaculty() == null || entity.getFaculty().isBlank())
                        && (entity.getDepartment() == null || entity.getDepartment().isBlank()))
                .findFirst();
    }

    private void deactivateExisting(
            StudentDocumentCategory category,
            String documentTypeName,
            String office,
            String faculty,
            String department
    ) {
        for (DocumentTemplateEntity existing : repository.findByActiveTrueOrderByTitleAsc()) {
            if (existing.getCategory() != category) {
                continue;
            }
            if (!documentTypeName.equalsIgnoreCase(String.valueOf(existing.getDocumentTypeName()))) {
                continue;
            }
            if (!matchesOptional(existing.getOffice(), office)) {
                continue;
            }
            if (!matchesOptional(existing.getFaculty(), faculty)) {
                continue;
            }
            if (!matchesOptional(existing.getDepartment(), department)) {
                continue;
            }
            existing.setActive(Boolean.FALSE);
            existing.setUpdatedAt(LocalDateTime.now());
            repository.save(existing);
        }
    }

    private boolean matchesOptional(String stored, String requested) {
        if (requested == null || requested.isBlank()) {
            return true;
        }
        if (stored == null || stored.isBlank()) {
            return true;
        }
        return requested.equalsIgnoreCase(stored.trim());
    }

    private void requireManageRole(UserRole role) {
        if (role != UserRole.ADMIN && role != UserRole.REGISTRAR && role != UserRole.EXAMINATION_OFFICER) {
            throw new IllegalArgumentException("You are not allowed to manage document templates.");
        }
    }

    private DocumentTemplateResponse toResponse(DocumentTemplateEntity entity) {
        return new DocumentTemplateResponse(
                entity.getId(),
                entity.getCategory(),
                entity.getDocumentTypeName(),
                entity.getOffice(),
                entity.getFaculty(),
                entity.getDepartment(),
                entity.getTitle(),
                entity.getPageCount(),
                entity.getOcrMethod(),
                entity.getSimilarityThreshold(),
                Boolean.TRUE.equals(entity.getActive()),
                textExtractionService.buildPreview(entity.getBaselineText()),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private String hashText(String text) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(text.getBytes()));
        } catch (Exception ex) {
            return null;
        }
    }

    private Long parseAccountId(String rawAccountId) {
        if (rawAccountId == null || rawAccountId.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(rawAccountId.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String normalizeOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
