package com.auca.archive.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record ShareItemsRequest(
        @NotBlank String targetRole,
        String permission,
        List<Long> folderIds,
        List<Long> documentIds
) {
}
