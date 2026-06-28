package com.auca.archive.dto;

import com.auca.archive.domain.StudentDocumentCategory;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.Min;
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
        String course,
        Integer marks,
        String examRoom,
        @NotBlank String uploadedBy,
        @NotNull StudentDocumentCategory category,
        @NotNull @Min(1) Integer pageCount,
        @NotNull @JsonFormat(pattern = "yyyy-MM-dd") LocalDate issueDate,
        String description,
        String tags
) {
}
