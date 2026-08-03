package com.auca.archive.dto;

public record OcrSettingsResponse(
        boolean enabled,
        boolean configuredEnabled,
        boolean available,
        String tessdataPath,
        String note
) {
}
