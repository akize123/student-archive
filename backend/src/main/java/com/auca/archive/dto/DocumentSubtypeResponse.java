package com.auca.archive.dto;

import com.auca.archive.domain.StudentDocumentCategory;

import java.time.LocalDateTime;

public record DocumentSubtypeResponse(
        Long id,
        StudentDocumentCategory category,
        String name,
        String code,
        String department,
        String description,
        boolean active,
        String createdBy,
        LocalDateTime createdAt
) {
}
