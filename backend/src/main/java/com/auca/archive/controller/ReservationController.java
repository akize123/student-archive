package com.auca.archive.controller;

import com.auca.archive.dto.ReservationAvailabilityResponse;
import com.auca.archive.dto.ReservationResponse;
import com.auca.archive.service.ReservationService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reservations")
public class ReservationController {
    private final ReservationService reservationService;

    public ReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    @PostMapping
    public ReservationResponse reserve(
            @RequestParam Long documentId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId
    ) {
        return reservationService.reserve(documentId, parseAccountId(accountId), role, studentNumber);
    }

    @GetMapping("/mine")
    public List<ReservationResponse> mine(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId
    ) {
        return reservationService.listMine(parseAccountId(accountId), role, studentNumber);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> release(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId
    ) {
        reservationService.release(id, parseAccountId(accountId), role, studentNumber);
        return Map.of("message", "Reservation released");
    }

    @GetMapping("/availability")
    public ReservationAvailabilityResponse availability(
            @RequestParam Long documentId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId
    ) {
        return reservationService.availability(documentId, parseAccountId(accountId), role, studentNumber);
    }

    private Long parseAccountId(String accountId) {
        if (accountId == null || accountId.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(accountId.trim());
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("Invalid account id");
        }
    }
}
