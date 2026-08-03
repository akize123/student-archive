package com.auca.archive.dto;

public record DocumentIntegrityResponse(
        Long documentId,
        String contentChecksumSha256,
        String integrityStatus,
        String message
) {
}
