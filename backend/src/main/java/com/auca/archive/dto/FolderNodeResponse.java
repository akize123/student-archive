package com.auca.archive.dto;

import java.util.List;

public record FolderNodeResponse(
        Long id,
        String name,
        String code,
        Long parentId,
        long itemCount,
        List<FolderNodeResponse> children
) {
}

