package com.auca.archive.dto;

import jakarta.validation.constraints.NotBlank;

public record AddAcademicYearRequest(
        @NotBlank(message = "Academic year is required")
        String academicYear
) {
}
