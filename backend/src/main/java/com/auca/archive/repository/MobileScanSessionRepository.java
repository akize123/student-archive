package com.auca.archive.repository;

import com.auca.archive.model.MobileScanSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;

public interface MobileScanSessionRepository extends JpaRepository<MobileScanSessionEntity, String> {
    void deleteByExpiresAtBefore(LocalDateTime cutoff);
}
