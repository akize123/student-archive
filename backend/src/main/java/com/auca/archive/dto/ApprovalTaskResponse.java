package com.auca.archive.dto;

import java.time.LocalDateTime;

public record ApprovalTaskResponse(
        Long id,
        Long documentId,
        String documentTitle,
        String requestedBy,
        String studentNumber,
        String description,
        String githubUrl,
        String externalLinks,
        String fileName,
        LocalDateTime requestedAt,
        LocalDateTime dueAt,
        String note,
        String priority,
        String status
) {
}

