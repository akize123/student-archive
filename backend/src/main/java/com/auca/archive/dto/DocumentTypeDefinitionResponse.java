package com.auca.archive.dto;

import com.auca.archive.domain.StudentDocumentCategory;

public record DocumentTypeDefinitionResponse(
        Long id,
        Long categoryDefinitionId,
        String categoryName,
        StudentDocumentCategory category,
        String name,
        String code,
        String office,
        String faculty,
        String department,
        boolean active
) {
}
