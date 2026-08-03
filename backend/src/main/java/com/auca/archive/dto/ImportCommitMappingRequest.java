package com.auca.archive.dto;

import com.auca.archive.domain.StudentDocumentCategory;
import jakarta.validation.constraints.NotBlank;

public record ImportCommitMappingRequest(
        @NotBlank String originalPath,
        @NotBlank String targetFolderName,
        String title,
        StudentDocumentCategory category,
        Long subtypeId
) {
}
