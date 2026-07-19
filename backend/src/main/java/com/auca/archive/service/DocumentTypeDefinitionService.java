package com.auca.archive.service;



import com.auca.archive.domain.StudentDocumentCategory;

import com.auca.archive.domain.UserRole;

import com.auca.archive.dto.CreateDocumentTypeDefinitionRequest;

import com.auca.archive.dto.DocumentTypeDefinitionResponse;

import com.auca.archive.model.DocumentCategoryDefinitionEntity;

import com.auca.archive.model.DocumentTypeDefinitionEntity;

import com.auca.archive.repository.DocumentCategoryDefinitionRepository;

import com.auca.archive.repository.DocumentTypeDefinitionRepository;

import jakarta.transaction.Transactional;

import org.springframework.stereotype.Service;



import java.time.LocalDateTime;

import java.util.List;

import java.util.Locale;

import java.util.Map;

import java.util.stream.Collectors;



@Service

public class DocumentTypeDefinitionService {

    private final DocumentTypeDefinitionRepository repository;

    private final DocumentCategoryDefinitionRepository categoryRepository;

    private final ArchiveAccessService accessService;



    public DocumentTypeDefinitionService(

            DocumentTypeDefinitionRepository repository,

            DocumentCategoryDefinitionRepository categoryRepository,

            ArchiveAccessService accessService

    ) {

        this.repository = repository;

        this.categoryRepository = categoryRepository;

        this.accessService = accessService;

    }



    public List<DocumentTypeDefinitionResponse> list(

            String rawRole,

            StudentDocumentCategory category,

            Long categoryDefinitionId,

            String office,

            String faculty,

            String department

    ) {

        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);

        Map<Long, DocumentCategoryDefinitionEntity> categoriesById = categoryRepository.findByActiveTrueOrderByNameAsc()

                .stream()

                .collect(Collectors.toMap(DocumentCategoryDefinitionEntity::getId, entity -> entity, (left, right) -> left));

        return repository.findByActiveTrueOrderByNameAsc().stream()

                .filter(entity -> categoryDefinitionId == null || categoryDefinitionId.equals(entity.getCategoryDefinitionId()))

                .filter(entity -> category == null || entity.getCategory() == category)

                .filter(entity -> matchesOptional(entity.getOffice(), office))

                .filter(entity -> matchesOptional(entity.getFaculty(), faculty))

                .filter(entity -> matchesOptional(entity.getDepartment(), department))

                .filter(entity -> role == null || role == UserRole.ADMIN || canAccessType(role, entity, categoriesById))

                .map(entity -> toResponse(entity, categoriesById))

                .toList();

    }

    public List<DocumentTypeDefinitionResponse> listByOffice(String rawRole, String office) {
        return list(rawRole, null, null, office, null, null);
    }



    @Transactional

    public DocumentTypeDefinitionResponse create(

            CreateDocumentTypeDefinitionRequest request,

            String rawRole,

            String rawAccountId

    ) {

        UserRole role = accessService.resolveRole(rawRole);

        requireManageRole(role);



        DocumentCategoryDefinitionEntity categoryDefinition = resolveCategoryDefinition(request);

        if (!accessService.canUploadCategory(role, resolveLegacyCategory(categoryDefinition, request.category()))) {

            throw new IllegalArgumentException("You cannot create document types for this category.");

        }



        String office = firstNonBlank(request.office(), categoryDefinition.getOffice(), "Registrar Office");
        String name = request.name() == null ? "" : request.name().trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("Document type name is required.");
        }

        if (repository.existsByCategoryDefinitionIdAndNameIgnoreCaseAndOffice(
                categoryDefinition.getId(),
                name,
                office
        )) {
            throw new IllegalArgumentException("A document type with this name already exists for the selected category.");
        }

        DocumentTypeDefinitionEntity entity = new DocumentTypeDefinitionEntity();
        entity.setCategoryDefinitionId(categoryDefinition.getId());
        entity.setCategory(resolveLegacyCategory(categoryDefinition, request.category()));
        entity.setName(name);
        entity.setCode(slugCode(name));
        entity.setOffice(office);

        entity.setFaculty(normalizeOptional(request.faculty()));

        entity.setDepartment(normalizeOptional(request.department()));

        entity.setActive(Boolean.TRUE);

        entity.setCreatedByAccountId(parseAccountId(rawAccountId));

        entity.setCreatedAt(LocalDateTime.now());

        return toResponse(repository.save(entity), Map.of(categoryDefinition.getId(), categoryDefinition));

    }



    public DocumentTypeDefinitionEntity requireActive(Long id) {

        DocumentTypeDefinitionEntity entity = repository.findById(id)

                .orElseThrow(() -> new IllegalArgumentException("Document type not found: " + id));

        if (!Boolean.TRUE.equals(entity.getActive())) {

            throw new IllegalArgumentException("Document type is inactive: " + entity.getName());

        }

        return entity;

    }



    private DocumentCategoryDefinitionEntity resolveCategoryDefinition(CreateDocumentTypeDefinitionRequest request) {

        if (request.categoryDefinitionId() != null) {

            return categoryRepository.findById(request.categoryDefinitionId())

                    .filter(entity -> Boolean.TRUE.equals(entity.getActive()))

                    .orElseThrow(() -> new IllegalArgumentException("Document category not found: " + request.categoryDefinitionId()));

        }

        if (request.category() == null) {

            throw new IllegalArgumentException("Document category is required.");

        }

        throw new IllegalArgumentException("Select a document category from the catalog.");

    }



    private StudentDocumentCategory resolveLegacyCategory(

            DocumentCategoryDefinitionEntity categoryDefinition,

            StudentDocumentCategory fallback

    ) {

        if (categoryDefinition.getLegacyCategory() != null) {

            return categoryDefinition.getLegacyCategory();

        }

        if (fallback != null) {

            return fallback;

        }

        return StudentDocumentCategory.APPLICATION_DOCUMENTS;

    }



    private boolean canAccessType(

            UserRole role,

            DocumentTypeDefinitionEntity entity,

            Map<Long, DocumentCategoryDefinitionEntity> categoriesById

    ) {

        if (entity.getCategoryDefinitionId() != null) {

            DocumentCategoryDefinitionEntity categoryDefinition = categoriesById.get(entity.getCategoryDefinitionId());

            if (categoryDefinition != null && categoryDefinition.getLegacyCategory() != null) {

                return accessService.canUploadCategory(role, categoryDefinition.getLegacyCategory());

            }

        }

        return accessService.canUploadCategory(role, entity.getCategory());

    }



    private void requireManageRole(UserRole role) {

        if (role != UserRole.ADMIN && role != UserRole.REGISTRAR && role != UserRole.EXAMINATION_OFFICER && role != UserRole.HOD) {

            throw new IllegalArgumentException("You are not allowed to manage document types.");

        }

    }



    private DocumentTypeDefinitionResponse toResponse(

            DocumentTypeDefinitionEntity entity,

            Map<Long, DocumentCategoryDefinitionEntity> categoriesById

    ) {

        DocumentCategoryDefinitionEntity categoryDefinition = entity.getCategoryDefinitionId() == null

                ? null

                : categoriesById.get(entity.getCategoryDefinitionId());

        String categoryName = categoryDefinition == null

                ? (entity.getCategory() == null ? null : entity.getCategory().getDisplayName())

                : categoryDefinition.getName();

        return new DocumentTypeDefinitionResponse(

                entity.getId(),

                entity.getCategoryDefinitionId(),

                categoryName,

                entity.getCategory(),

                entity.getName(),

                entity.getCode(),

                entity.getOffice(),

                entity.getFaculty(),

                entity.getDepartment(),

                Boolean.TRUE.equals(entity.getActive())

        );

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



    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
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

