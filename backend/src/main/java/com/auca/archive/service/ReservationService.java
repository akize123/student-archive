package com.auca.archive.service;

import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.domain.ReservationStatus;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.CreateReservationRequest;
import com.auca.archive.dto.ReservableBookResponse;
import com.auca.archive.dto.ReservationAvailabilityResponse;
import com.auca.archive.dto.ReservationResponse;
import com.auca.archive.dto.ReservationSlotResponse;
import com.auca.archive.dto.FolderNodeResponse;
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
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

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
    public ReservationResponse reserve(CreateReservationRequest request, Long studentAccountId, String rawRole, String rawStudentNumber) {
        UserRole role = accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        if (role != UserRole.STUDENT) {
            throw new IllegalArgumentException("Only students can reserve archive books");
        }
        if (studentAccountId == null) {
            throw new IllegalArgumentException("Student account is required to reserve books");
        }
        if (request == null || request.documentId() == null || request.startsAt() == null) {
            throw new IllegalArgumentException("Document and start time are required");
        }

        DocumentEntity document = requireReservableDocument(request.documentId(), studentNumber);
        expireStaleReservations();

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startsAt = request.startsAt().withSecond(0).withNano(0);
        if (startsAt.isBefore(now.minusMinutes(1))) {
            throw new IllegalArgumentException("Start time must be in the future");
        }
        if (startsAt.isAfter(now.plusDays(14))) {
            throw new IllegalArgumentException("Reservations can only be scheduled up to 14 days ahead");
        }

        LocalDateTime expiresAt = startsAt.plusMinutes(ttlMinutes);
        String purpose = trimPurpose(request.purpose());

        return reservationRepository
                .findFirstByDocumentIdAndStudentAccountIdAndStatusAndExpiresAtAfterOrderByStartsAtAsc(
                        document.getId(),
                        studentAccountId,
                        ReservationStatus.ACTIVE,
                        now
                )
                .map(existing -> toResponse(existing, document.getTitle()))
                .orElseGet(() -> createReservation(document, studentAccountId, studentNumber, now, startsAt, expiresAt, purpose));
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
                .sorted(Comparator.comparing(this::effectiveStartsAt))
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
            String rawStudentNumber,
            LocalDateTime requestedStartsAt
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
        List<ReservationEntity> upcoming = reservationRepository.findByDocumentIdAndStatusAndExpiresAtAfterOrderByStartsAtAsc(
                documentId,
                ReservationStatus.ACTIVE,
                now
        );
        int activeNow = countOverlappingAt(upcoming, now, now.plusMinutes(1));
        List<ReservationSlotResponse> bookedSlots = upcoming.stream()
                .map(reservation -> new ReservationSlotResponse(effectiveStartsAt(reservation), reservation.getExpiresAt()))
                .toList();

        Long myReservationId = null;
        LocalDateTime myReservationStartsAt = null;
        LocalDateTime myReservationExpiresAt = null;
        if (studentAccountId != null) {
            var mine = reservationRepository.findFirstByDocumentIdAndStudentAccountIdAndStatusAndExpiresAtAfterOrderByStartsAtAsc(
                    documentId,
                    studentAccountId,
                    ReservationStatus.ACTIVE,
                    now
            );
            myReservationId = mine.map(ReservationEntity::getId).orElse(null);
            myReservationStartsAt = mine.map(this::effectiveStartsAt).orElse(null);
            myReservationExpiresAt = mine.map(ReservationEntity::getExpiresAt).orElse(null);
        }

        int available = Math.max(0, maxConcurrentPerDocument - activeNow);
        Boolean requestedSlotAvailable = null;
        if (requestedStartsAt != null) {
            LocalDateTime slotStart = requestedStartsAt.withSecond(0).withNano(0);
            LocalDateTime slotEnd = slotStart.plusMinutes(ttlMinutes);
            int overlapping = countOverlappingAt(upcoming, slotStart, slotEnd);
            requestedSlotAvailable = overlapping < maxConcurrentPerDocument;
        }

        return new ReservationAvailabilityResponse(
                documentId,
                activeNow,
                maxConcurrentPerDocument,
                available,
                myReservationId != null,
                myReservationId,
                myReservationStartsAt,
                myReservationExpiresAt,
                bookedSlots,
                requestedSlotAvailable
        );
    }

    public List<ReservableBookResponse> listReservableBooks(String rawRole, String rawStudentNumber) {
        UserRole role = accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        if (role != UserRole.STUDENT) {
            throw new IllegalArgumentException("Only students can browse reservable books");
        }

        FolderNodeResponse tree = folderService.getStudentPublishedArchiveTree(studentNumber)
                .orElseThrow(() -> new IllegalArgumentException("Published archive is unavailable for this student"));

        Set<Long> documentIds = new LinkedHashSet<>();
        collectPublishedDocumentIds(tree, documentIds);

        return documentIds.stream()
                .map(documentRepository::findById)
                .flatMap(java.util.Optional::stream)
                .filter(document -> !document.isArchivedForRemoval())
                .filter(document -> folderService.isPublishedPeerDocument(document, studentNumber))
                .sorted(Comparator.comparing(DocumentEntity::getTitle, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .map(document -> new ReservableBookResponse(
                        document.getId(),
                        document.getTitle(),
                        document.getStudentNumber(),
                        document.getOwnerName(),
                        document.getDepartment()
                ))
                .toList();
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
                        && !effectiveStartsAt(reservation).isAfter(now)
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
            LocalDateTime now,
            LocalDateTime startsAt,
            LocalDateTime expiresAt,
            String purpose
    ) {
        List<ReservationEntity> overlapping = reservationRepository.findOverlapping(
                document.getId(),
                ReservationStatus.ACTIVE,
                startsAt,
                expiresAt
        );
        if (overlapping.size() >= maxConcurrentPerDocument) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "That time overlaps with 3 existing reservations. Pick another start time."
            );
        }

        boolean studentAlreadyBooked = overlapping.stream()
                .anyMatch(reservation -> studentAccountId.equals(reservation.getStudentAccountId()));
        if (studentAlreadyBooked) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "You already have a reservation for this book during that time."
            );
        }

        ReservationEntity reservation = new ReservationEntity();
        reservation.setDocumentId(document.getId());
        reservation.setStudentAccountId(studentAccountId);
        reservation.setStudentNumber(studentNumber.trim().toUpperCase(Locale.ROOT));
        reservation.setStatus(ReservationStatus.ACTIVE);
        reservation.setCreatedAt(now);
        reservation.setStartsAt(startsAt);
        reservation.setExpiresAt(expiresAt);
        reservation.setPurpose(purpose);
        ReservationEntity saved = reservationRepository.save(reservation);
        return toResponse(saved, document.getTitle());
    }

    private void collectPublishedDocumentIds(FolderNodeResponse node, Set<Long> documentIds) {
        if (node == null) {
            return;
        }
        if (ArchiveTreeService.isPublishedArchiveFolderCode(node.code())) {
            Long documentId = ArchiveTreeService.parseLinkedDocumentIdFromFolderCode(node.code());
            if (documentId != null) {
                documentIds.add(documentId);
            }
        }
        if (node.children() != null) {
            for (FolderNodeResponse child : node.children()) {
                collectPublishedDocumentIds(child, documentIds);
            }
        }
    }

    private int countOverlappingAt(List<ReservationEntity> reservations, LocalDateTime slotStart, LocalDateTime slotEnd) {
        int count = 0;
        for (ReservationEntity reservation : reservations) {
            if (overlaps(reservation, slotStart, slotEnd)) {
                count += 1;
            }
        }
        return count;
    }

    private boolean overlaps(ReservationEntity reservation, LocalDateTime slotStart, LocalDateTime slotEnd) {
        LocalDateTime existingStart = effectiveStartsAt(reservation);
        LocalDateTime existingEnd = reservation.getExpiresAt();
        return existingStart.isBefore(slotEnd) && existingEnd.isAfter(slotStart);
    }

    private LocalDateTime effectiveStartsAt(ReservationEntity reservation) {
        if (reservation.getStartsAt() != null) {
            return reservation.getStartsAt();
        }
        return reservation.getCreatedAt();
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
                effectiveStartsAt(reservation),
                reservation.getExpiresAt(),
                reservation.getPurpose(),
                reservation.getStatus() == null ? ReservationStatus.ACTIVE.name() : reservation.getStatus().name()
        );
    }

    private String trimPurpose(String purpose) {
        if (purpose == null) {
            return null;
        }
        String trimmed = purpose.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.length() > 500 ? trimmed.substring(0, 500) : trimmed;
    }

    private String normalizeStudentNumber(String rawStudentNumber) {
        if (rawStudentNumber == null || rawStudentNumber.isBlank()) {
            return null;
        }
        return rawStudentNumber.trim();
    }
}
