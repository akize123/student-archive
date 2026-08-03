package com.auca.archive.dto;

public record DocumentScanContext(
        String studentNumber,
        String studentName,
        String category,
        String course,
        String faculty,
        String department,
        String fileName,
        Long documentSubtypeId,
        String office
) {
    public DocumentScanContext(
            String studentNumber,
            String studentName,
            String category,
            String course,
            String faculty,
            String department,
            String fileName
    ) {
        this(studentNumber, studentName, category, course, faculty, department, fileName, null, null);
    }

    public DocumentScanContext(
            String studentNumber,
            String studentName,
            String category,
            String course,
            String faculty,
            String department,
            String fileName,
            Long documentSubtypeId
    ) {
        this(studentNumber, studentName, category, course, faculty, department, fileName, documentSubtypeId, null);
    }
}
