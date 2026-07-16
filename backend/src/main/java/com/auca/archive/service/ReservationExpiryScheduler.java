package com.auca.archive.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ReservationExpiryScheduler {
    private final ReservationService reservationService;

    public ReservationExpiryScheduler(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    @Scheduled(fixedDelayString = "${archive.reservation.expiry-check-ms:60000}")
    public void expireReservations() {
        reservationService.expireStaleReservations();
    }
}
