package com.auca.archive.dto;

import java.util.List;

public record FolderNodeResponse(
        Long id,
        String name,
        String code,
        Long parentId,
        long itemCount,
        boolean locked,
        List<FolderNodeResponse> children
) {
    public FolderNodeResponse(
            Long id,
            String name,
            String code,
            Long parentId,
            long itemCount,
            List<FolderNodeResponse> children
    ) {
        this(id, name, code, parentId, itemCount, false, children);
    }
}
