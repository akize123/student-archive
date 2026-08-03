package com.auca.archive.model;

import com.auca.archive.domain.StudentDocumentCategory;
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
@Table(name = "document_templates")
public class DocumentTemplateEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    private StudentDocumentCategory category;

    private Long documentSubtypeId;
    private String documentTypeName;
    private String office;
    private String faculty;
    private String department;
    private String title;
    private String filePath;
    private String encryptionIv;

    @Column(columnDefinition = "TEXT")
    private String baselineText;

    private String baselineTextHash;
    private Integer pageCount;
    private String ocrMethod;
    private Integer similarityThreshold;
    private Boolean active;
    private Long uploadedByAccountId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public DocumentTemplateEntity() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public StudentDocumentCategory getCategory() {
        return category;
    }

    public void setCategory(StudentDocumentCategory category) {
        this.category = category;
    }

    public Long getDocumentSubtypeId() {
        return documentSubtypeId;
    }

    public void setDocumentSubtypeId(Long documentSubtypeId) {
        this.documentSubtypeId = documentSubtypeId;
    }

    public String getDocumentTypeName() {
        return documentTypeName;
    }

    public void setDocumentTypeName(String documentTypeName) {
        this.documentTypeName = documentTypeName;
    }

    public String getOffice() {
        return office;
    }

    public void setOffice(String office) {
        this.office = office;
    }

    public String getFaculty() {
        return faculty;
    }

    public void setFaculty(String faculty) {
        this.faculty = faculty;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public String getEncryptionIv() {
        return encryptionIv;
    }

    public void setEncryptionIv(String encryptionIv) {
        this.encryptionIv = encryptionIv;
    }

    public String getBaselineText() {
        return baselineText;
    }

    public void setBaselineText(String baselineText) {
        this.baselineText = baselineText;
    }

    public String getBaselineTextHash() {
        return baselineTextHash;
    }

    public void setBaselineTextHash(String baselineTextHash) {
        this.baselineTextHash = baselineTextHash;
    }

    public Integer getPageCount() {
        return pageCount;
    }

    public void setPageCount(Integer pageCount) {
        this.pageCount = pageCount;
    }

    public String getOcrMethod() {
        return ocrMethod;
    }

    public void setOcrMethod(String ocrMethod) {
        this.ocrMethod = ocrMethod;
    }

    public Integer getSimilarityThreshold() {
        return similarityThreshold;
    }

    public void setSimilarityThreshold(Integer similarityThreshold) {
        this.similarityThreshold = similarityThreshold;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public Long getUploadedByAccountId() {
        return uploadedByAccountId;
    }

    public void setUploadedByAccountId(Long uploadedByAccountId) {
        this.uploadedByAccountId = uploadedByAccountId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
