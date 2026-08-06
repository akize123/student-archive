package com.auca.archive.dto;

import com.auca.archive.domain.StudentDocumentCategory;
import jakarta.validation.constraints.NotBlank;

public record ImportCommitMappingRequest(
        @NotBlank String originalPath,
        @NotBlank String targetFolderName,
        String title,
        StudentDocumentCategory category,
        Long subtypeId,
        /** Placement academic year folder (e.g. 2024-2025) in the archive tree. */
        String academicYear,
        /** Placement semester folder (e.g. 2024/1) under the year. */
        String semester,
        /** Optional display file name to store instead of the ZIP entry name. */
        String uploadFileName,
        /** Primary document type folder (e.g. Application Form). */
        String documentTypeLabel
) {
}
