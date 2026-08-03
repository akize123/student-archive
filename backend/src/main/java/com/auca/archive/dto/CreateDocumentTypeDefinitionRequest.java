package com.auca.archive.dto;

import com.auca.archive.domain.StudentDocumentCategory;
import jakarta.validation.constraints.NotBlank;

public record CreateDocumentTypeDefinitionRequest(
        Long categoryDefinitionId,
        StudentDocumentCategory category,
        @NotBlank String name,
        @NotBlank String office,
        String faculty,
        String department
) {
}
