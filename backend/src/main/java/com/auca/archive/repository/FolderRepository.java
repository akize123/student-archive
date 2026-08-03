package com.auca.archive.repository;

import com.auca.archive.model.FolderEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FolderRepository extends JpaRepository<FolderEntity, Long> {
    Optional<FolderEntity> findByCode(String code);
    List<FolderEntity> findByArchivedAtIsNull();
    Optional<FolderEntity> findFirstByCodeContaining(String marker);
}