package com.auca.archive.model;

import com.auca.archive.domain.StudentDocumentCategory;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "document_subtypes")
public class DocumentSubtypeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    private StudentDocumentCategory category;

    private String name;
    private String code;
    private String department;
    private String description;
    private String requiredKeywordsJson;
    private Integer minPages;
    private Integer maxPages;
    private Boolean active;
    private String createdBy;
    private LocalDateTime createdAt;

    public DocumentSubtypeEntity() {
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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getRequiredKeywordsJson() {
        return requiredKeywordsJson;
    }

    public void setRequiredKeywordsJson(String requiredKeywordsJson) {
        this.requiredKeywordsJson = requiredKeywordsJson;
    }

    public Integer getMinPages() {
        return minPages;
    }

    public void setMinPages(Integer minPages) {
        this.minPages = minPages;
    }

    public Integer getMaxPages() {
        return maxPages;
    }

    public void setMaxPages(Integer maxPages) {
        this.maxPages = maxPages;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
