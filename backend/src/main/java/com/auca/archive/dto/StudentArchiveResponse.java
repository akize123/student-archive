package com.auca.archive.dto;

import java.util.List;

public record StudentArchiveResponse(
        String studentNumber,
        String studentName,
        String faculty,
        String department,
        long documentCount,
        List<DocumentListItemResponse> documents
) {
}
