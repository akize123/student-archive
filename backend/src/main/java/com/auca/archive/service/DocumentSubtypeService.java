package com.auca.archive.service;

import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.CreateDocumentSubtypeRequest;
import com.auca.archive.dto.DocumentSubtypeResponse;
import com.auca.archive.dto.UpdateDocumentSubtypeRequest;
import com.auca.archive.model.DocumentSubtypeEntity;
import com.auca.archive.repository.DocumentSubtypeRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
public class DocumentSubtypeService {
    private final DocumentSubtypeRepository repository;
    private final ArchiveAccessService accessService;

    public DocumentSubtypeService(DocumentSubtypeRepository repository, ArchiveAccessService accessService) {
        this.repository = repository;
        this.accessService = accessService;
    }

    public List<DocumentSubtypeResponse> list(String rawRole, StudentDocumentCategory category, String department) {
        UserRole role = resolveOptionalRole(rawRole);
        List<DocumentSubtypeEntity> entities;
        if (category == null) {
            entities = repository.findByActiveTrueOrderByNameAsc();
        } else if (department != null && !department.isBlank()) {
            entities = repository.findByCategoryAndDepartmentAndActiveTrueOrderByNameAsc(category, department.trim());
            if (entities.isEmpty()) {
                entities = repository.findByCategoryAndDepartmentIsNullAndActiveTrueOrderByNameAsc(category);
            }
        } else {
            entities = repository.findByCategoryAndActiveTrueOrderByNameAsc(category);
        }
        return entities.stream()
                .filter(entity -> role == null || role == UserRole.ADMIN || accessService.canUploadCategory(role, entity.getCategory()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public DocumentSubtypeResponse create(CreateDocumentSubtypeRequest request, String rawRole, String createdBy) {
        UserRole role = accessService.resolveRole(rawRole);
        requireManageRole(role);
        if (!accessService.canUploadCategory(role, request.category())) {
            throw new IllegalArgumentException("You cannot create sub-types for this category.");
        }

        String department = normalizeOptional(request.department());
        String name = request.name().trim();
        if (repository.existsByCategoryAndNameIgnoreCaseAndDepartment(request.category(), name, department)) {
            throw new IllegalArgumentException("A sub-type with this name already exists for the selected scope.");
        }

        DocumentSubtypeEntity entity = new DocumentSubtypeEntity();
        entity.setCategory(request.category());
        entity.setName(name);
        entity.setCode(request.code() == null || request.code().isBlank() ? slugCode(name) : request.code().trim().toUpperCase(Locale.ROOT));
        entity.setDepartment(department);
        entity.setDescription(trimOptional(request.description()));
        entity.setActive(Boolean.TRUE);
        entity.setCreatedBy(createdBy == null || createdBy.isBlank() ? role.name() : createdBy.trim());
        entity.setCreatedAt(LocalDateTime.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public DocumentSubtypeResponse update(Long id, UpdateDocumentSubtypeRequest request, String rawRole) {
        UserRole role = accessService.resolveRole(rawRole);
        requireManageRole(role);
        DocumentSubtypeEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Document sub-type not found: " + id));
        if (request.name() != null && !request.name().isBlank()) {
            entity.setName(request.name().trim());
        }
        if (request.description() != null) {
            entity.setDescription(trimOptional(request.description()));
        }
        if (request.active() != null) {
            entity.setActive(request.active());
        }
        return toResponse(repository.save(entity));
    }

    public DocumentSubtypeEntity getOrThrow(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Document sub-type not found: " + id));
    }

    private void requireManageRole(UserRole role) {
        if (role != UserRole.ADMIN && role != UserRole.REGISTRAR && role != UserRole.EXAMINATION_OFFICER && role != UserRole.HOD) {
            throw new IllegalArgumentException("You are not allowed to manage document sub-types.");
        }
    }

    private UserRole resolveOptionalRole(String rawRole) {
        if (rawRole == null || rawRole.isBlank()) {
            return null;
        }
        return accessService.resolveRole(rawRole);
    }

    private DocumentSubtypeResponse toResponse(DocumentSubtypeEntity entity) {
        return new DocumentSubtypeResponse(
                entity.getId(),
                entity.getCategory(),
                entity.getName(),
                entity.getCode(),
                entity.getDepartment(),
                entity.getDescription(),
                Boolean.TRUE.equals(entity.getActive()),
                entity.getCreatedBy(),
                entity.getCreatedAt()
        );
    }

    private String normalizeOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String trimOptional(String value) {
        return value == null ? null : value.trim();
    }

    private String slugCode(String name) {
        return name.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
    }
}
