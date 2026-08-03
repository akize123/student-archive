package com.auca.archive.repository;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.model.ActivityEntryEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ActivityEntryRepository extends JpaRepository<ActivityEntryEntity, Long> {
    List<ActivityEntryEntity> findTop6ByOrderByCreatedAtDesc();

    List<ActivityEntryEntity> findTop50ByOrderByCreatedAtDesc();

    Page<ActivityEntryEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<ActivityEntryEntity> findBySourceRoleOrderByCreatedAtDesc(UserRole sourceRole, Pageable pageable);

    Page<ActivityEntryEntity> findByActorAccountIdOrderByCreatedAtDesc(Long actorAccountId, Pageable pageable);

    Page<ActivityEntryEntity> findBySourceRoleAndActorAccountIdOrderByCreatedAtDesc(
            UserRole sourceRole,
            Long actorAccountId,
            Pageable pageable
    );

    long countBySourceRole(UserRole sourceRole);

    long countByActorAccountId(Long actorAccountId);

    @Query("""
            SELECT a FROM ActivityEntryEntity a
            WHERE (:role IS NULL OR a.sourceRole = :role)
              AND (:userId IS NULL OR a.actorAccountId = :userId)
              AND (:category IS NULL OR a.category = :category)
            ORDER BY a.createdAt DESC
            """)
    Page<ActivityEntryEntity> findFiltered(
            @Param("role") UserRole role,
            @Param("userId") Long userId,
            @Param("category") ActivityCategory category,
            Pageable pageable
    );
}
