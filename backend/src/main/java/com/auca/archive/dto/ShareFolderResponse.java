package com.auca.archive.dto;

public record ShareFolderResponse(
        String message,
        String shareUrl,
        String targetRole,
        String targetRoleLabel
) {
}
