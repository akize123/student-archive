package com.auca.archive.dto;

public record ReservationAvailabilityResponse(
        Long documentId,
        int activeReservations,
        int maxConcurrent,
        int availableSlots,
        boolean reservedByMe,
        Long myReservationId,
        java.time.LocalDateTime myReservationExpiresAt
) {
}
