package com.auca.archive.dto;

public record DocumentScanContext(
        String studentNumber,
        String studentName,
        String category,
        String course,
        String faculty,
        String department,
        String fileName
) {
}
