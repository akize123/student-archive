package com.auca.archive.dto;

import java.time.LocalDateTime;

public record ReservationSlotResponse(
        LocalDateTime startsAt,
        LocalDateTime expiresAt
) {
}
