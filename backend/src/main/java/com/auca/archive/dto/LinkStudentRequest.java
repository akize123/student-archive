package com.auca.archive.dto;

import jakarta.validation.constraints.NotBlank;

public record LinkStudentRequest(
        @NotBlank String studentNumber
) {
}
