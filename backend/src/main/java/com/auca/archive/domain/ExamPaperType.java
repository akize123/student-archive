package com.auca.archive.domain;

public enum ExamPaperType {
    MID_SEM("Mid-Sem", "MIDSEM", 30),
    FINAL_EXAMS("Final Exams", "FINAL", 40);

    private final String displayName;
    private final String folderCode;
    private final int maxMarks;

    ExamPaperType(String displayName, String folderCode, int maxMarks) {
        this.displayName = displayName;
        this.folderCode = folderCode;
        this.maxMarks = maxMarks;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getFolderCode() {
        return folderCode;
    }

    public int getMaxMarks() {
        return maxMarks;
    }

    public static ExamPaperType from(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Exam type is required");
        }
        String normalized = value.trim()
                .toUpperCase()
                .replaceAll("[^A-Z0-9]+", "_");
        return ExamPaperType.valueOf(normalized);
    }
}
