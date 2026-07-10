package com.auca.archive.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record DocumentDetailResponse(
        Long id,
        String title,
        String fileName,
        String documentCode,
        String ownerName,
        String studentNumber,
        String department,
        String uploadedBy,
        String description,
        String tags,
        String filePath,
        String mimeType,
        Long folderId,
        Long sizeBytes,
        Integer pageCount,
        LocalDate issueDate,
        Boolean starred,
        LocalDateTime createdAt,
        LocalDateTime modifiedAt,
        String status,
        String type,
        String category,
        String examType,
        String academicYear,
        String semester,
        String course,
        Integer marks,
        String examRoom,
        String githubUrl,
        String externalLinks,
        String reviewNote,
        String downloadUrl
) {
}
