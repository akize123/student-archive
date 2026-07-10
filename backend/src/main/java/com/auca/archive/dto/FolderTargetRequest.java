package com.auca.archive.dto;

import jakarta.validation.constraints.NotNull;

public record FolderTargetRequest(
        @NotNull(message = "Destination folder is required")
        Long targetParentId
) {
}
