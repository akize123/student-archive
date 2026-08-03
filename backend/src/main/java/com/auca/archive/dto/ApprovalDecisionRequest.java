package com.auca.archive.dto;

import jakarta.validation.constraints.NotBlank;

public record ApprovalDecisionRequest(
        @NotBlank String decision,
        String note
) {
}

