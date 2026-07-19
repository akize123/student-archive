package com.auca.archive.dto;

import java.time.LocalDateTime;

public record ReservationResponse(
        Long id,
        Long documentId,
        String documentTitle,
        String studentNumber,
        LocalDateTime createdAt,
        LocalDateTime startsAt,
        LocalDateTime expiresAt,
        String purpose,
        String status
) {
}
