package com.auca.archive.dto;

import com.auca.archive.domain.StudentDocumentCategory;

import java.time.LocalDateTime;

public record DocumentTemplateResponse(
        Long id,
        StudentDocumentCategory category,
        String documentTypeName,
        String office,
        String faculty,
        String department,
        String title,
        Integer pageCount,
        String ocrMethod,
        Integer similarityThreshold,
        boolean active,
        String baselinePreview,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
