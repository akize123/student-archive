package com.auca.archive.dto;

import java.util.List;

public record StudentLookupResponse(
        boolean found,
        String studentNumber,
        String studentName,
        String faculty,
        String department,
        Long folderId,
        long documentCount,
        List<DocumentListItemResponse> documents
) {
    public static StudentLookupResponse notFound(String studentNumber) {
        return new StudentLookupResponse(
                false,
                studentNumber,
                null,
                null,
                null,
                null,
                0L,
                List.of()
        );
    }

    public static StudentLookupResponse fromArchive(StudentArchiveResponse archive) {
        return new StudentLookupResponse(
                true,
                archive.studentNumber(),
                archive.studentName(),
                archive.faculty(),
                archive.department(),
                archive.folderId(),
                archive.documentCount(),
                archive.documents()
        );
    }
}
