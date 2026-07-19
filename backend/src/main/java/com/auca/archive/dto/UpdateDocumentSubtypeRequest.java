package com.auca.archive.dto;

public record UpdateDocumentSubtypeRequest(
        String name,
        String description,
        Boolean active
) {
}
