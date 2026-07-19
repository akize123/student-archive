package com.auca.archive.repository;

import com.auca.archive.model.DocumentCategoryDefinitionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentCategoryDefinitionRepository extends JpaRepository<DocumentCategoryDefinitionEntity, Long> {
    List<DocumentCategoryDefinitionEntity> findByActiveTrueOrderByNameAsc();

    boolean existsByNameIgnoreCaseAndOffice(String name, String office);

    Optional<DocumentCategoryDefinitionEntity> findByNameIgnoreCaseAndOffice(String name, String office);
}
