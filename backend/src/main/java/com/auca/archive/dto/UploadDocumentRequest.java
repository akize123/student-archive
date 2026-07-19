package com.auca.archive.dto;

import com.auca.archive.domain.StudentDocumentCategory;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record UploadDocumentRequest(
        String title,
        @NotBlank String studentNumber,
        @NotBlank String studentName,
        String faculty,
        String department,
        String examType,
        String academicYear,
        String semester,
        /** Browse-context year for outer student folder (Faculty/Dept/Year/Sem/Student). */
        String placementAcademicYear,
        /** Browse-context semester for outer student folder. */
        String placementSemester,
        String course,
        Integer marks,
        String examRoom,
        @NotBlank String uploadedBy,
        @NotNull StudentDocumentCategory category,
        Integer pageCount,
        @JsonFormat(pattern = "yyyy-MM-dd") LocalDate issueDate,
        String description,
        String tags,
        String githubUrl,
        String externalLinks,
        String projectTitle,
        Long documentSubtypeId,
        Long documentTypeId,
        Long categoryDefinitionId
) {
}
