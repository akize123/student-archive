package com.auca.archive.dto;

import java.time.LocalDateTime;

public record SharedItemResponse(
        Long shareId,
        String itemType,
        Long folderId,
        Long documentId,
        String name,
        String permission,
        String permissionLabel,
        String sharedBy,
        String targetRole,
        LocalDateTime sharedAt,
        String openUrl
) {
}
