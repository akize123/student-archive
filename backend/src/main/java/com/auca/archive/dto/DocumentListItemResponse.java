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
        Boolean starred,
        String examType,
        String academicYear,
        String semester,
        String course,
        Integer marks,
        String examRoom
) {
}
