package com.auca.archive.dto;

public record UpdateDocumentTemplateRequest(
        String title,
        Integer similarityThreshold,
        Boolean active
) {
}
