package com.auca.archive.model;

import com.auca.archive.domain.SharePermission;
import com.auca.archive.domain.UserRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "folder_shares")
public class FolderShareEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long folderId;
    private Long documentId;
    private Long facultyFolderId;

    @Enumerated(EnumType.STRING)
    private UserRole targetRole;

    @Enumerated(EnumType.STRING)
    private SharePermission permission;

    private String sharedBy;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;

    @Column(name = "allow_reshare")
    private Boolean allowReshare;

    public FolderShareEntity() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getFolderId() {
        return folderId;
    }

    public void setFolderId(Long folderId) {
        this.folderId = folderId;
    }

    public Long getDocumentId() {
        return documentId;
    }

    public void setDocumentId(Long documentId) {
        this.documentId = documentId;
    }

    public Long getFacultyFolderId() {
        return facultyFolderId;
    }

    public void setFacultyFolderId(Long facultyFolderId) {
        this.facultyFolderId = facultyFolderId;
    }

    public UserRole getTargetRole() {
        return targetRole;
    }

    public void setTargetRole(UserRole targetRole) {
        this.targetRole = targetRole;
    }

    public SharePermission getPermission() {
        return permission == null ? SharePermission.READ_ONLY : permission;
    }

    public void setPermission(SharePermission permission) {
        this.permission = permission;
    }

    public String getSharedBy() {
        return sharedBy;
    }

    public void setSharedBy(String sharedBy) {
        this.sharedBy = sharedBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    public boolean isAllowReshare() {
        return Boolean.TRUE.equals(allowReshare);
    }

    public void setAllowReshare(boolean allowReshare) {
        this.allowReshare = allowReshare;
    }
}
