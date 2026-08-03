package com.auca.archive.dto;

import com.auca.archive.domain.SharePermission;

import java.time.LocalDateTime;

public record DocumentShareAccessContext(
        boolean accessViaShare,
        boolean allowDownload,
        SharePermission sharePermission,
        String sharePermissionLabel,
        LocalDateTime shareExpiresAt
) {
    public static DocumentShareAccessContext fullAccess() {
        return new DocumentShareAccessContext(false, true, null, null, null);
    }
}
