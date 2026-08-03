package com.auca.archive.service;

import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.CreateDocumentCategoryDefinitionRequest;
import com.auca.archive.dto.DocumentCategoryDefinitionResponse;
import com.auca.archive.model.DocumentCategoryDefinitionEntity;
import com.auca.archive.repository.DocumentCategoryDefinitionRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
public class DocumentCategoryDefinitionService {
    private final DocumentCategoryDefinitionRepository repository;
    private final ArchiveAccessService accessService;

    public DocumentCategoryDefinitionService(
            DocumentCategoryDefinitionRepository repository,
            ArchiveAccessService accessService
    ) {
        this.repository = repository;
        this.accessService = accessService;
    }

    public List<DocumentCategoryDefinitionResponse> list(
            String rawRole,
            String office,
            String faculty,
            String department
    ) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        return repository.findByActiveTrueOrderByNameAsc().stream()
                .filter(entity -> matchesCatalogOffice(entity.getOffice(), office))
                .filter(entity -> matchesOptional(entity.getFaculty(), faculty))
                .filter(entity -> matchesOptional(entity.getDepartment(), department))
                .filter(entity -> role == null || role == UserRole.ADMIN || canAccessCategory(role, entity))
                .map(this::toResponse)
                .toList();
    }

    private boolean matchesCatalogOffice(String storedOffice, String requestedOffice) {
        if (requestedOffice == null || requestedOffice.isBlank()) {
            return true;
        }
        // Role dashboard labels that are not real catalog offices — rely on role access instead.
        String normalized = requestedOffice.trim();
        if (normalized.equalsIgnoreCase("Department Office")
                || normalized.equalsIgnoreCase("ICT Office")
                || normalized.equalsIgnoreCase("Student Workspace")) {
            return true;
        }
        return matchesOptional(storedOffice, requestedOffice);
    }

    @Transactional
    public DocumentCategoryDefinitionResponse create(
            CreateDocumentCategoryDefinitionRequest request,
            String rawRole,
            String rawAccountId
    ) {
        UserRole role = accessService.resolveRole(rawRole);
        requireManageRole(role);
        String office = request.office().trim();
        String name = request.name().trim();
        if (repository.existsByNameIgnoreCaseAndOffice(name, office)) {
            throw new IllegalArgumentException("A category with this name already exists for the selected office.");
        }
        DocumentCategoryDefinitionEntity entity = new DocumentCategoryDefinitionEntity();
        entity.setName(name);
        entity.setCode(slugCode(name));
        entity.setOffice(office);
        entity.setFaculty(normalizeOptional(request.faculty()));
        entity.setDepartment(normalizeOptional(request.department()));
        entity.setLegacyCategory(request.legacyCategory());
        entity.setActive(Boolean.TRUE);
        entity.setCreatedByAccountId(parseAccountId(rawAccountId));
        entity.setCreatedAt(LocalDateTime.now());
        return toResponse(repository.save(entity));
    }

    public DocumentCategoryDefinitionEntity requireActive(Long id) {
        DocumentCategoryDefinitionEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Document category not found: " + id));
        if (!Boolean.TRUE.equals(entity.getActive())) {
            throw new IllegalArgumentException("Document category is inactive: " + entity.getName());
        }
        return entity;
    }

    private boolean canAccessCategory(UserRole role, DocumentCategoryDefinitionEntity entity) {
        if (entity.getLegacyCategory() != null) {
            return accessService.canUploadCategory(role, entity.getLegacyCategory());
        }
        return role != UserRole.STUDENT;
    }

    private void requireManageRole(UserRole role) {
        if (role != UserRole.ADMIN
                && role != UserRole.REGISTRAR
                && role != UserRole.EXAMINATION_OFFICER
                && role != UserRole.HOD) {
            throw new IllegalArgumentException("You are not allowed to manage document categories.");
        }
    }

    private DocumentCategoryDefinitionResponse toResponse(DocumentCategoryDefinitionEntity entity) {
        return new DocumentCategoryDefinitionResponse(
                entity.getId(),
                entity.getName(),
                entity.getCode(),
                entity.getOffice(),
                entity.getFaculty(),
                entity.getDepartment(),
                entity.getLegacyCategory(),
                Boolean.TRUE.equals(entity.getActive())
        );
    }

    private boolean matchesOptional(String stored, String requested) {
        if (requested == null || requested.isBlank()) {
            return true;
        }
        // Null/blank stored means the catalog entry applies to any faculty/department/office filter.
        if (stored == null || stored.isBlank()) {
            return true;
        }
        return requested.equalsIgnoreCase(stored.trim());
    }

    private String normalizeOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String slugCode(String name) {
        return name.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
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
}
