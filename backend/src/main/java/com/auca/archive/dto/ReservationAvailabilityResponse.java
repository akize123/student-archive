package com.auca.archive.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ReservationAvailabilityResponse(
        Long documentId,
        int activeReservations,
        int maxConcurrent,
        int availableSlots,
        boolean reservedByMe,
        Long myReservationId,
        LocalDateTime myReservationStartsAt,
        LocalDateTime myReservationExpiresAt,
        List<ReservationSlotResponse> bookedSlots,
        Boolean requestedSlotAvailable
) {
}
