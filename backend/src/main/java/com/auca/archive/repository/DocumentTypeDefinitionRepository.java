package com.auca.archive.repository;

import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.model.DocumentTypeDefinitionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentTypeDefinitionRepository extends JpaRepository<DocumentTypeDefinitionEntity, Long> {
    List<DocumentTypeDefinitionEntity> findByActiveTrueOrderByNameAsc();

    List<DocumentTypeDefinitionEntity> findByCategoryAndActiveTrueOrderByNameAsc(StudentDocumentCategory category);

    List<DocumentTypeDefinitionEntity> findByCategoryAndOfficeAndActiveTrueOrderByNameAsc(
            StudentDocumentCategory category,
            String office
    );

    List<DocumentTypeDefinitionEntity> findByCategoryDefinitionIdAndActiveTrueOrderByNameAsc(Long categoryDefinitionId);

    boolean existsByCategoryDefinitionIdAndNameIgnoreCaseAndOffice(
            Long categoryDefinitionId,
            String name,
            String office
    );
}
