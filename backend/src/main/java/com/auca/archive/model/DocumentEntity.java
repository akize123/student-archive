package com.auca.archive.model;

import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.domain.DocumentType;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "documents")
public class DocumentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private String fileName;
    private String documentCode;
    private String ownerName;
    private String studentNumber;
    private String department;
    private String uploadedBy;
    private String description;
    private String tags;
    private String examType;
    private String academicYear;
    private String semester;
    private String course;
    private Integer marks;
    private String examRoom;
    private String filePath;
    private String mimeType;
    private Long folderId;
    private Long sizeBytes;
    private Integer pageCount;
    private LocalDate issueDate;
    private Boolean starred;
    private LocalDateTime createdAt;
    private LocalDateTime modifiedAt;

    @Enumerated(EnumType.STRING)
    private DocumentStatus status;

    @Enumerated(EnumType.STRING)
    private DocumentType type;

    @Enumerated(EnumType.STRING)
    private StudentDocumentCategory category;

    @Enumerated(EnumType.STRING)
    private UserRole uploadedByRole;

    private LocalDateTime archivedAt;
    private String archivedBy;
    private Boolean encrypted;
    private String encryptionIv;
    private String coverPhotoPath;
    private String githubUrl;
    private String externalLinks;
    private String reviewNote;
    private Long documentSubtypeId;
    private Long documentTypeId;
    private Long categoryDefinitionId;
    private String contentChecksumSha256;
    private String checksumAlgorithm;
    private Boolean compressed;
    private Long originalSizeBytes;
    private String convertedFromMime;

    public DocumentEntity() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getDocumentCode() {
        return documentCode;
    }

    public void setDocumentCode(String documentCode) {
        this.documentCode = documentCode;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
    }

    public String getStudentNumber() {
        return studentNumber;
    }

    public void setStudentNumber(String studentNumber) {
        this.studentNumber = studentNumber;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getUploadedBy() {
        return uploadedBy;
    }

    public void setUploadedBy(String uploadedBy) {
        this.uploadedBy = uploadedBy;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
    }

    public String getExamType() {
        return examType;
    }

    public void setExamType(String examType) {
        this.examType = examType;
    }

    public String getAcademicYear() {
        return academicYear;
    }

    public void setAcademicYear(String academicYear) {
        this.academicYear = academicYear;
    }

    public String getSemester() {
        return semester;
    }

    public void setSemester(String semester) {
        this.semester = semester;
    }

    public String getCourse() {
        return course;
    }

    public void setCourse(String course) {
        this.course = course;
    }

    public Integer getMarks() {
        return marks;
    }

    public void setMarks(Integer marks) {
        this.marks = marks;
    }

    public String getExamRoom() {
        return examRoom;
    }

    public void setExamRoom(String examRoom) {
        this.examRoom = examRoom;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public Long getFolderId() {
        return folderId;
    }

    public void setFolderId(Long folderId) {
        this.folderId = folderId;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(Long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public Integer getPageCount() {
        return pageCount;
    }

    public void setPageCount(Integer pageCount) {
        this.pageCount = pageCount;
    }

    public LocalDate getIssueDate() {
        return issueDate;
    }

    public void setIssueDate(LocalDate issueDate) {
        this.issueDate = issueDate;
    }

    public Boolean getStarred() {
        return starred;
    }

    public void setStarred(Boolean starred) {
        this.starred = starred;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getModifiedAt() {
        return modifiedAt;
    }

    public void setModifiedAt(LocalDateTime modifiedAt) {
        this.modifiedAt = modifiedAt;
    }

    public DocumentStatus getStatus() {
        return status;
    }

    public void setStatus(DocumentStatus status) {
        this.status = status;
    }

    public DocumentType getType() {
        return type;
    }

    public void setType(DocumentType type) {
        this.type = type;
    }

    public StudentDocumentCategory getCategory() {
        return category;
    }

    public void setCategory(StudentDocumentCategory category) {
        this.category = category;
    }

    public UserRole getUploadedByRole() {
        return uploadedByRole;
    }

    public void setUploadedByRole(UserRole uploadedByRole) {
        this.uploadedByRole = uploadedByRole;
    }

    public LocalDateTime getArchivedAt() {
        return archivedAt;
    }

    public void setArchivedAt(LocalDateTime archivedAt) {
        this.archivedAt = archivedAt;
    }

    public String getArchivedBy() {
        return archivedBy;
    }

    public void setArchivedBy(String archivedBy) {
        this.archivedBy = archivedBy;
    }

    public Boolean getEncrypted() {
        return encrypted;
    }

    public void setEncrypted(Boolean encrypted) {
        this.encrypted = encrypted;
    }

    public String getEncryptionIv() {
        return encryptionIv;
    }

    public void setEncryptionIv(String encryptionIv) {
        this.encryptionIv = encryptionIv;
    }

    public String getCoverPhotoPath() {
        return coverPhotoPath;
    }

    public void setCoverPhotoPath(String coverPhotoPath) {
        this.coverPhotoPath = coverPhotoPath;
    }

    public String getGithubUrl() {
        return githubUrl;
    }

    public void setGithubUrl(String githubUrl) {
        this.githubUrl = githubUrl;
    }

    public String getExternalLinks() {
        return externalLinks;
    }

    public void setExternalLinks(String externalLinks) {
        this.externalLinks = externalLinks;
    }

    public String getReviewNote() {
        return reviewNote;
    }

    public void setReviewNote(String reviewNote) {
        this.reviewNote = reviewNote;
    }

    public Long getDocumentSubtypeId() {
        return documentSubtypeId;
    }

    public void setDocumentSubtypeId(Long documentSubtypeId) {
        this.documentSubtypeId = documentSubtypeId;
    }

    public Long getDocumentTypeId() {
        return documentTypeId;
    }

    public void setDocumentTypeId(Long documentTypeId) {
        this.documentTypeId = documentTypeId;
    }

    public Long getCategoryDefinitionId() {
        return categoryDefinitionId;
    }

    public void setCategoryDefinitionId(Long categoryDefinitionId) {
        this.categoryDefinitionId = categoryDefinitionId;
    }

    public String getContentChecksumSha256() {
        return contentChecksumSha256;
    }

    public void setContentChecksumSha256(String contentChecksumSha256) {
        this.contentChecksumSha256 = contentChecksumSha256;
    }

    public String getChecksumAlgorithm() {
        return checksumAlgorithm;
    }

    public void setChecksumAlgorithm(String checksumAlgorithm) {
        this.checksumAlgorithm = checksumAlgorithm;
    }

    public Boolean getCompressed() {
        return compressed;
    }

    public void setCompressed(Boolean compressed) {
        this.compressed = compressed;
    }

    public Long getOriginalSizeBytes() {
        return originalSizeBytes;
    }

    public void setOriginalSizeBytes(Long originalSizeBytes) {
        this.originalSizeBytes = originalSizeBytes;
    }

    public String getConvertedFromMime() {
        return convertedFromMime;
    }

    public void setConvertedFromMime(String convertedFromMime) {
        this.convertedFromMime = convertedFromMime;
    }

    public boolean isArchivedForRemoval() {
        return archivedAt != null;
    }
}
