package com.auca.archive.repository;

import com.auca.archive.domain.UserRole;
import com.auca.archive.model.FolderShareEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FolderShareRepository extends JpaRepository<FolderShareEntity, Long> {
    List<FolderShareEntity> findByTargetRoleOrderByCreatedAtDesc(UserRole targetRole);

    Optional<FolderShareEntity> findByFolderIdAndTargetRoleAndDocumentIdIsNull(Long folderId, UserRole targetRole);

    Optional<FolderShareEntity> findByDocumentIdAndTargetRole(Long documentId, UserRole targetRole);

    List<FolderShareEntity> findByFacultyFolderIdAndTargetRole(Long facultyFolderId, UserRole targetRole);

    long countByTargetRole(UserRole targetRole);

    @Modifying
    @Query("DELETE FROM FolderShareEntity share WHERE LOWER(share.sharedBy) = LOWER(:sharedBy)")
    int deleteBySharedByIgnoreCase(@Param("sharedBy") String sharedBy);

    /** @deprecated prefer findByFolderIdAndTargetRoleAndDocumentIdIsNull */
    default Optional<FolderShareEntity> findByFolderIdAndTargetRole(Long folderId, UserRole targetRole) {
        return findByFolderIdAndTargetRoleAndDocumentIdIsNull(folderId, targetRole);
    }
}
