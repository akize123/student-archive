package com.auca.archive.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record DocumentListItemResponse(
        Long id,
        String title,
        String ownerName,
        String studentNumber,
        String department,
        LocalDate issueDate,
        LocalDateTime modifiedAt,
        String status,
        String fileName,
        Long sizeBytes,
        Integer pageCount,
        String category,
        String type,
        String folderName,
        Long folderId,
        Boolean starred,
        String examType,
        String academicYear,
        String semester,
        String course,
        Integer marks,
        String examRoom,
        LocalDateTime archivedAt,
        String archivedBy,
        String githubUrl,
        String externalLinks,
        String reviewNote,
        String description,
        Boolean hasCoverPhoto
) {
}
