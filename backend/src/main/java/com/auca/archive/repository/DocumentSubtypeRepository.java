package com.auca.archive.repository;

import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.model.DocumentSubtypeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentSubtypeRepository extends JpaRepository<DocumentSubtypeEntity, Long> {
    List<DocumentSubtypeEntity> findByActiveTrueOrderByNameAsc();

    List<DocumentSubtypeEntity> findByCategoryAndActiveTrueOrderByNameAsc(StudentDocumentCategory category);

    List<DocumentSubtypeEntity> findByCategoryAndDepartmentAndActiveTrueOrderByNameAsc(
            StudentDocumentCategory category,
            String department
    );

    List<DocumentSubtypeEntity> findByCategoryAndDepartmentIsNullAndActiveTrueOrderByNameAsc(
            StudentDocumentCategory category
    );

    Optional<DocumentSubtypeEntity> findByCategoryAndNameIgnoreCaseAndDepartmentIgnoreCase(
            StudentDocumentCategory category,
            String name,
            String department
    );

    boolean existsByCategoryAndNameIgnoreCaseAndDepartment(
            StudentDocumentCategory category,
            String name,
            String department
    );
}
