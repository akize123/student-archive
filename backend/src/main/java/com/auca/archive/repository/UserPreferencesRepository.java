package com.auca.archive.repository;

import com.auca.archive.model.UserPreferencesEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserPreferencesRepository extends JpaRepository<UserPreferencesEntity, Long> {
}
