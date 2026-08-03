package com.auca.archive.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateDocumentStatusRequest(
        @NotBlank String status
) {
}

