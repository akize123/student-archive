package com.auca.archive.dto;

import com.auca.archive.domain.StudentDocumentCategory;

import java.util.List;

public record ImportPreviewResponse(
        int totalFiles,
        int importableCount,
        int skippedCount,
        StudentDocumentCategory defaultCategory,
        Long defaultSubtypeId,
        List<ImportPreviewItemResponse> items,
        List<String> messages,
        List<ZipAuditEntryResponse> zipAudit
) {
}
