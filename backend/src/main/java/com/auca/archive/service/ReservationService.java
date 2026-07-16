package com.auca.archive.service;

import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.domain.ReservationStatus;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.ReservationAvailabilityResponse;
import com.auca.archive.dto.ReservationResponse;
import com.auca.archive.model.DocumentEntity;
import com.auca.archive.model.ReservationEntity;
import com.auca.archive.repository.DocumentRepository;
import com.auca.archive.repository.ReservationRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
public class ReservationService {
    private final ReservationRepository reservationRepository;
    private final DocumentRepository documentRepository;
    private final ArchiveAccessService accessService;
    private final FolderService folderService;

    private final int ttlMinutes;
    private final int maxConcurrentPerDocument;

    public ReservationService(
            ReservationRepository reservationRepository,
            DocumentRepository documentRepository,
            ArchiveAccessService accessService,
            FolderService folderService,
            @Value("${archive.reservation.ttl-minutes:20}") int ttlMinutes,
            @Value("${archive.reservation.max-concurrent-per-document:3}") int maxConcurrentPerDocument
    ) {
        this.reservationRepository = reservationRepository;
        this.documentRepository = documentRepository;
        this.accessService = accessService;
        this.folderService = folderService;
        this.ttlMinutes = ttlMinutes;
        this.maxConcurrentPerDocument = maxConcurrentPerDocument;
    }

    @Transactional
    public ReservationResponse reserve(Long documentId, Long studentAccountId, String rawRole, String rawStudentNumber) {
        UserRole role = accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        if (role != UserRole.STUDENT) {
            throw new IllegalArgumentException("Only students can reserve archive books");
        }
        if (studentAccountId == null) {
            throw new IllegalArgumentException("Student account is required to reserve books");
        }

        DocumentEntity document = requireReservableDocument(documentId, studentNumber);
        expireStaleReservations();

        LocalDateTime now = LocalDateTime.now();
        return reservationRepository
                .findFirstByDocumentIdAndStudentAccountIdAndStatusAndExpiresAtAfter(
                        document.getId(),
                        studentAccountId,
                        ReservationStatus.ACTIVE,
                        now
                )
                .map(existing -> toResponse(existing, document.getTitle()))
                .orElseGet(() -> createReservation(document, studentAccountId, studentNumber, now));
    }

    public List<ReservationResponse> listMine(Long studentAccountId, String rawRole, String rawStudentNumber) {
        UserRole role = accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        if (role != UserRole.STUDENT) {
            throw new IllegalArgumentException("Only students can view reservations");
        }
        if (studentAccountId == null) {
            throw new IllegalArgumentException("Student account is required");
        }

        expireStaleReservations();
        LocalDateTime now = LocalDateTime.now();
        return reservationRepository
                .findByStudentAccountIdAndStatusAndExpiresAtAfterOrderByExpiresAtAsc(
                        studentAccountId,
                        ReservationStatus.ACTIVE,
                        now
                )
                .stream()
                .map(reservation -> documentRepository.findById(reservation.getDocumentId())
                        .map(document -> toResponse(reservation, document.getTitle()))
                        .orElse(toResponse(reservation, "Archived book")))
                .toList();
    }

    @Transactional
    public void release(Long reservationId, Long studentAccountId, String rawRole, String rawStudentNumber) {
        UserRole role = accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        if (role != UserRole.STUDENT || studentAccountId == null) {
            throw new IllegalArgumentException("Only students can release reservations");
        }

        ReservationEntity reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Reservation not found: " + reservationId));
        if (!studentAccountId.equals(reservation.getStudentAccountId())) {
            throw new IllegalArgumentException("Reservation not found: " + reservationId);
        }
        if (reservation.getStatus() != ReservationStatus.ACTIVE) {
            return;
        }
        reservation.setStatus(ReservationStatus.RELEASED);
        reservation.setReleasedAt(LocalDateTime.now());
        reservationRepository.save(reservation);
    }

    public ReservationAvailabilityResponse availability(
            Long documentId,
            Long studentAccountId,
            String rawRole,
            String rawStudentNumber
    ) {
        UserRole role = accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        if (role != UserRole.STUDENT) {
            throw new IllegalArgumentException("Only students can check reservation availability");
        }

        requireReservableDocument(documentId, studentNumber);
        expireStaleReservations();

        LocalDateTime now = LocalDateTime.now();
        int active = (int) reservationRepository.countByDocumentIdAndStatusAndExpiresAtAfter(
                documentId,
                ReservationStatus.ACTIVE,
                now
        );
        Long myReservationId = null;
        java.time.LocalDateTime myReservationExpiresAt = null;
        if (studentAccountId != null) {
            var mine = reservationRepository
                    .findFirstByDocumentIdAndStudentAccountIdAndStatusAndExpiresAtAfter(
                            documentId,
                            studentAccountId,
                            ReservationStatus.ACTIVE,
                            now
                    );
            myReservationId = mine.map(ReservationEntity::getId).orElse(null);
            myReservationExpiresAt = mine.map(ReservationEntity::getExpiresAt).orElse(null);
        }
        int available = Math.max(0, maxConcurrentPerDocument - active);
        return new ReservationAvailabilityResponse(
                documentId,
                active,
                maxConcurrentPerDocument,
                available,
                myReservationId != null,
                myReservationId,
                myReservationExpiresAt
        );
    }

    public boolean hasActiveReservation(Long documentId, String studentNumber) {
        if (documentId == null || studentNumber == null || studentNumber.isBlank()) {
            return false;
        }
        expireStaleReservations();
        LocalDateTime now = LocalDateTime.now();
        return reservationRepository.findAll().stream()
                .anyMatch(reservation -> reservation.getStatus() == ReservationStatus.ACTIVE
                        && documentId.equals(reservation.getDocumentId())
                        && reservation.getExpiresAt() != null
                        && reservation.getExpiresAt().isAfter(now)
                        && studentNumber.trim().equalsIgnoreCase(reservation.getStudentNumber()));
    }

    @Transactional
    public int expireStaleReservations() {
        LocalDateTime now = LocalDateTime.now();
        List<ReservationEntity> expired = reservationRepository.findByStatusAndExpiresAtBefore(
                ReservationStatus.ACTIVE,
                now
        );
        for (ReservationEntity reservation : expired) {
            reservation.setStatus(ReservationStatus.EXPIRED);
            reservation.setReleasedAt(now);
        }
        reservationRepository.saveAll(expired);
        return expired.size();
    }

    private ReservationResponse createReservation(
            DocumentEntity document,
            Long studentAccountId,
            String studentNumber,
            LocalDateTime now
    ) {
        long active = reservationRepository.countByDocumentIdAndStatusAndExpiresAtAfter(
                document.getId(),
                ReservationStatus.ACTIVE,
                now
        );
        if (active >= maxConcurrentPerDocument) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "All reservation slots are in use for this book. Try again in a few minutes."
            );
        }

        ReservationEntity reservation = new ReservationEntity();
        reservation.setDocumentId(document.getId());
        reservation.setStudentAccountId(studentAccountId);
        reservation.setStudentNumber(studentNumber.trim().toUpperCase(Locale.ROOT));
        reservation.setStatus(ReservationStatus.ACTIVE);
        reservation.setCreatedAt(now);
        reservation.setExpiresAt(now.plusMinutes(ttlMinutes));
        ReservationEntity saved = reservationRepository.save(reservation);
        return toResponse(saved, document.getTitle());
    }

    private DocumentEntity requireReservableDocument(Long documentId, String studentNumber) {
        DocumentEntity document = documentRepository.findById(documentId)
                .filter(entity -> !entity.isArchivedForRemoval())
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + documentId));
        if (document.getCategory() != StudentDocumentCategory.FINAL_YEAR_PROJECT
                || document.getStatus() != DocumentStatus.APPROVED) {
            throw new IllegalArgumentException("Only approved final year project books can be reserved");
        }
        if (accessService.isStudentDocument(document, studentNumber)) {
            throw new IllegalArgumentException("You already own this project book");
        }
        if (!folderService.isPublishedPeerDocument(document, studentNumber)) {
            throw new IllegalArgumentException("This book is not available in your department archive");
        }
        return document;
    }

    private ReservationResponse toResponse(ReservationEntity reservation, String documentTitle) {
        return new ReservationResponse(
                reservation.getId(),
                reservation.getDocumentId(),
                documentTitle,
                reservation.getStudentNumber(),
                reservation.getCreatedAt(),
                reservation.getExpiresAt(),
                reservation.getStatus() == null ? ReservationStatus.ACTIVE.name() : reservation.getStatus().name()
        );
    }

    private String normalizeStudentNumber(String rawStudentNumber) {
        if (rawStudentNumber == null || rawStudentNumber.isBlank()) {
            return null;
        }
        return rawStudentNumber.trim();
    }
}
