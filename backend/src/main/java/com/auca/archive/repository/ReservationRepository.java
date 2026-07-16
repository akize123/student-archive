package com.auca.archive.repository;

import com.auca.archive.domain.ReservationStatus;
import com.auca.archive.model.ReservationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
