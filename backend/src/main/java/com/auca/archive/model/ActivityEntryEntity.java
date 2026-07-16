package com.auca.archive.model;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.StudentDocumentCategory;
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
@Table(name = "activities")
public class ActivityEntryEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String message;
    private String actor;
    private LocalDateTime createdAt;

    @Enumerated(EnumType.STRING)
    private ActivityCategory category;

    @Enumerated(EnumType.STRING)
    private UserRole sourceRole;

    @Enumerated(EnumType.STRING)
    private UserRole targetRole;

    private String academicDepartment;

    @Enumerated(EnumType.STRING)
    private StudentDocumentCategory documentCategory;

    private String studentNumber;

    @Column(name = "actor_account_id")
    private Long actorAccountId;

    @Column(name = "actor_username", length = 120)
    private String actorUsername;

    public ActivityEntryEntity() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getActor() {
        return actor;
    }

    public void setActor(String actor) {
        this.actor = actor;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public ActivityCategory getCategory() {
        return category;
    }

    public void setCategory(ActivityCategory category) {
        this.category = category;
    }

    public UserRole getSourceRole() {
        return sourceRole;
    }

    public void setSourceRole(UserRole sourceRole) {
        this.sourceRole = sourceRole;
    }

    public UserRole getTargetRole() {
        return targetRole;
    }

    public void setTargetRole(UserRole targetRole) {
        this.targetRole = targetRole;
    }

    public String getAcademicDepartment() {
        return academicDepartment;
    }

    public void setAcademicDepartment(String academicDepartment) {
        this.academicDepartment = academicDepartment;
    }

    public StudentDocumentCategory getDocumentCategory() {
        return documentCategory;
    }

    public void setDocumentCategory(StudentDocumentCategory documentCategory) {
        this.documentCategory = documentCategory;
    }

    public String getStudentNumber() {
        return studentNumber;
    }

    public void setStudentNumber(String studentNumber) {
        this.studentNumber = studentNumber;
    }

    public Long getActorAccountId() {
        return actorAccountId;
    }

    public void setActorAccountId(Long actorAccountId) {
        this.actorAccountId = actorAccountId;
    }

    public String getActorUsername() {
        return actorUsername;
    }

    public void setActorUsername(String actorUsername) {
        this.actorUsername = actorUsername;
    }
}
