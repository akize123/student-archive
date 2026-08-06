package com.auca.archive.dto;

import java.util.List;

public record StudentLookupResponse(
        boolean found,
        String studentNumber,
        String studentName,
        String faculty,
        String department,
        String academicYear,
        String semester,
        Long folderId,
        long documentCount,
        List<DocumentListItemResponse> documents,
        boolean registeredByRegistrar
) {
    public static StudentLookupResponse notFound(String studentNumber) {
        return new StudentLookupResponse(
                false,
                studentNumber,
                null,
                null,
                null,
                null,
                null,
                null,
                0L,
                List.of(),
                false
        );
    }

    public static StudentLookupResponse fromArchive(StudentArchiveResponse archive) {
        return fromArchive(archive, true);
    }

    public static StudentLookupResponse fromArchive(StudentArchiveResponse archive, boolean registeredByRegistrar) {
        return new StudentLookupResponse(
                true,
                archive.studentNumber(),
                archive.studentName(),
                archive.faculty(),
                archive.department(),
                archive.academicYear(),
                archive.semester(),
                archive.folderId(),
                archive.documentCount(),
                archive.documents(),
                registeredByRegistrar
        );
    }
}
