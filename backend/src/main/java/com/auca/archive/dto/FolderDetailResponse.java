package com.auca.archive.dto;

import java.util.List;

public record FolderDetailResponse(
        Long id,
        String name,
        String code,
        Long parentId,
        List<FolderBreadcrumbResponse> breadcrumbs,
        long itemCount,
        List<FolderNodeResponse> children,
        List<DocumentListItemResponse> documents
) {
}
