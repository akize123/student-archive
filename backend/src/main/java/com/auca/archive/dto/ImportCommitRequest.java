package com.auca.archive.dto;

import com.auca.archive.domain.StudentDocumentCategory;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record ImportCommitRequest(
        @NotEmpty List<ImportCommitMappingRequest> mappings,
        StudentDocumentCategory defaultCategory,
        Long defaultSubtypeId,
        boolean validateTemplates,
        boolean linkLegacy
) {
}
