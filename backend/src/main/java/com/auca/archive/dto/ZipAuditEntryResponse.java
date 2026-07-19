package com.auca.archive.dto;

public record ZipAuditEntryResponse(
        String path,
        long sizeBytes,
        String action,
        String note
) {
}
