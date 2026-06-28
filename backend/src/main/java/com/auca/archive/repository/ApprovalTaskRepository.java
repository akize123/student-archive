package com.auca.archive.repository;

import com.auca.archive.domain.ApprovalStatus;
import com.auca.archive.model.ApprovalTaskEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApprovalTaskRepository extends JpaRepository<ApprovalTaskEntity, Long> {
    List<ApprovalTaskEntity> findTop5ByStatusOrderByRequestedAtAsc(ApprovalStatus status);
    long countByStatus(ApprovalStatus status);
}

