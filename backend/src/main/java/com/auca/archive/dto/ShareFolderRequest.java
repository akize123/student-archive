package com.auca.archive.dto;

import jakarta.validation.constraints.NotBlank;

public record ShareFolderRequest(
        @NotBlank String targetRole,
        String permission,
        String expirationPreset,
        String expiresAt,
        Boolean allowReshare
) {
}
