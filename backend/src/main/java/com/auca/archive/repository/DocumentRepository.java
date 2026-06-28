package com.auca.archive.repository;

import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.model.DocumentEntity;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Collection;

public interface DocumentRepository extends JpaRepository<DocumentEntity, Long> {
    List<DocumentEntity> findTop8ByOrderByModifiedAtDesc();
    List<DocumentEntity> findTop12ByStatusOrderByModifiedAtAsc(DocumentStatus status);
    List<DocumentEntity> findByStudentNumberOrderByIssueDateDesc(String studentNumber);
    List<DocumentEntity> findByStudentNumberIgnoreCaseOrderByIssueDateDesc(String studentNumber);
    List<DocumentEntity> findByCategoryOrderByModifiedAtDesc(StudentDocumentCategory category);
    List<DocumentEntity> findByFolderId(Long folderId);
    List<DocumentEntity> findByFolderIdOrderByModifiedAtDesc(Long folderId);
    List<DocumentEntity> findByFolderIdInOrderByModifiedAtDesc(Collection<Long> folderIds);
    long countByFolderId(Long folderId);
    long countByStatus(DocumentStatus status);

    @Query("""
            select d
            from DocumentEntity d
            where lower(coalesce(d.title, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(d.fileName, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(d.ownerName, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(d.studentNumber, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(d.department, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(d.description, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(d.tags, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(d.examType, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(d.academicYear, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(d.semester, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(d.course, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(d.examRoom, '')) like lower(concat('%', :query, '%'))
            order by d.modifiedAt desc
            """)
    List<DocumentEntity> searchArchive(@Param("query") String query);

    long countByCreatedAtAfter(java.time.LocalDateTime createdAt);
}
