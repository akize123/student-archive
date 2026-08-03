package com.auca.archive.dto;

import com.auca.archive.domain.StudentDocumentCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateDocumentSubtypeRequest(
        @NotNull StudentDocumentCategory category,
        @NotBlank String name,
        String code,
        String department,
        String description
) {
}
