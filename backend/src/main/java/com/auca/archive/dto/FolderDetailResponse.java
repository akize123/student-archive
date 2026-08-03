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
        List<DocumentListItemResponse> documents,
        /** Student ID folder name when this folder is inside a semester student tree. */
        String semesterStudentNumber,
        /** Full name from the student record linked to the semester student folder. */
        String semesterStudentName
) {
}
