package com.auca.archive.dto;

import com.auca.archive.domain.StudentDocumentCategory;
import jakarta.validation.constraints.NotBlank;

public record CreateDocumentCategoryDefinitionRequest(
        @NotBlank String name,
        @NotBlank String office,
        String faculty,
        String department,
        StudentDocumentCategory legacyCategory
) {
}
