package com.auca.archive.dto;

import java.time.LocalDateTime;

public record ApprovalTaskResponse(
        Long id,
        Long documentId,
        String documentTitle,
        String requestedBy,
        LocalDateTime requestedAt,
        LocalDateTime dueAt,
        String note,
        String priority,
        String status
) {
}

