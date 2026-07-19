package com.auca.archive.repository;

import com.auca.archive.model.DocumentTemplateEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentTemplateRepository extends JpaRepository<DocumentTemplateEntity, Long> {
    List<DocumentTemplateEntity> findByActiveTrueOrderByTitleAsc();

    Optional<DocumentTemplateEntity> findByDocumentSubtypeIdAndDepartmentAndActiveTrue(
            Long documentSubtypeId,
            String department
    );

    Optional<DocumentTemplateEntity> findByDocumentSubtypeIdAndDepartmentIsNullAndActiveTrue(
            Long documentSubtypeId
    );

    List<DocumentTemplateEntity> findByDocumentSubtypeId(Long documentSubtypeId);
}
