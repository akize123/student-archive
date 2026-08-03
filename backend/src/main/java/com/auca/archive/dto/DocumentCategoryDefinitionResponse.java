package com.auca.archive.dto;

import com.auca.archive.domain.StudentDocumentCategory;

public record DocumentCategoryDefinitionResponse(
        Long id,
        String name,
        String code,
        String office,
        String faculty,
        String department,
        StudentDocumentCategory legacyCategory,
        boolean active
) {
}
