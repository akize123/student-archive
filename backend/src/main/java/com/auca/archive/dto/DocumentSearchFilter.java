package com.auca.archive.dto;

import com.auca.archive.domain.StudentDocumentCategory;

import java.util.List;

public record DocumentSearchFilter(
        String q,
        StudentDocumentCategory category,
        List<StudentDocumentCategory> categories,
        List<StudentDocumentCategory> excludeCategories,
        List<Long> documentTypeIds,
        String academicYear,
        String semester,
        String office,
        String kind
) {
}
