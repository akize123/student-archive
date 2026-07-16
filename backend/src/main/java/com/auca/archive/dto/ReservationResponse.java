package com.auca.archive.dto;

import java.time.LocalDateTime;

public record ReservationResponse(
        Long id,
        Long documentId,
        String documentTitle,
        String studentNumber,
        LocalDateTime createdAt,
        LocalDateTime expiresAt,
        String status
) {
}
