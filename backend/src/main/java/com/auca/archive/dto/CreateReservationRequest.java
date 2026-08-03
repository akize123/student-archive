package com.auca.archive.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public record CreateReservationRequest(
        @NotNull(message = "Document id is required")
        Long documentId,
        @NotNull(message = "Start time is required")
        LocalDateTime startsAt,
        String purpose
) {
}
