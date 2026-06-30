package com.auca.archive.repository;

import com.auca.archive.model.ActivityEntryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActivityEntryRepository extends JpaRepository<ActivityEntryEntity, Long> {
    List<ActivityEntryEntity> findTop6ByOrderByCreatedAtDesc();

    List<ActivityEntryEntity> findTop50ByOrderByCreatedAtDesc();
}

