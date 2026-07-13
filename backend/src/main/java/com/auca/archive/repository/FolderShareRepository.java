package com.auca.archive.repository;

import com.auca.archive.domain.UserRole;
import com.auca.archive.model.FolderShareEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FolderShareRepository extends JpaRepository<FolderShareEntity, Long> {
    List<FolderShareEntity> findByTargetRoleOrderByCreatedAtDesc(UserRole targetRole);

    Optional<FolderShareEntity> findByFolderIdAndTargetRoleAndDocumentIdIsNull(Long folderId, UserRole targetRole);

    Optional<FolderShareEntity> findByDocumentIdAndTargetRole(Long documentId, UserRole targetRole);

    List<FolderShareEntity> findByFacultyFolderIdAndTargetRole(Long facultyFolderId, UserRole targetRole);

    long countByTargetRole(UserRole targetRole);

    /** @deprecated prefer findByFolderIdAndTargetRoleAndDocumentIdIsNull */
    default Optional<FolderShareEntity> findByFolderIdAndTargetRole(Long folderId, UserRole targetRole) {
        return findByFolderIdAndTargetRoleAndDocumentIdIsNull(folderId, targetRole);
    }
}
