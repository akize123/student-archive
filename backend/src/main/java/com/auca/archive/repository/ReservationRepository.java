package com.auca.archive.repository;

import com.auca.archive.domain.ReservationStatus;
import com.auca.archive.model.ReservationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ReservationRepository extends JpaRepository<ReservationEntity, Long> {
    long countByDocumentIdAndStatusAndExpiresAtAfter(
            Long documentId,
            ReservationStatus status,
            LocalDateTime now
    );

    List<ReservationEntity> findByStudentAccountIdAndStatusAndExpiresAtAfterOrderByExpiresAtAsc(
            Long studentAccountId,
            ReservationStatus status,
            LocalDateTime now
    );

    Optional<ReservationEntity> findFirstByDocumentIdAndStudentAccountIdAndStatusAndExpiresAtAfter(
            Long documentId,
            Long studentAccountId,
            ReservationStatus status,
            LocalDateTime now
    );

    List<ReservationEntity> findByStatusAndExpiresAtBefore(ReservationStatus status, LocalDateTime cutoff);

    List<ReservationEntity> findByDocumentIdAndStatusAndExpiresAtAfterOrderByStartsAtAsc(
            Long documentId,
            ReservationStatus status,
            LocalDateTime now
    );

    @Query("""
            SELECT r FROM ReservationEntity r
            WHERE r.documentId = :documentId
              AND r.status = :status
              AND COALESCE(r.startsAt, r.createdAt) < :slotEnd
              AND r.expiresAt > :slotStart
            """)
    List<ReservationEntity> findOverlapping(
            @Param("documentId") Long documentId,
            @Param("status") ReservationStatus status,
            @Param("slotStart") LocalDateTime slotStart,
            @Param("slotEnd") LocalDateTime slotEnd
    );

    Optional<ReservationEntity> findFirstByDocumentIdAndStudentAccountIdAndStatusAndExpiresAtAfterOrderByStartsAtAsc(
            Long documentId,
            Long studentAccountId,
            ReservationStatus status,
            LocalDateTime now
    );
}
