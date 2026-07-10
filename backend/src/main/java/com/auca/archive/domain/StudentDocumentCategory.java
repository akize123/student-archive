package com.auca.archive.domain;

public enum StudentDocumentCategory {
    REGISTRATION_FORM("Registration Forms", "SREG"),
    REINTEGRATION_FORM("Reintegration Forms", "SRIN"),
    APPLICATION_DOCUMENTS("Application Documents", "SAPP"),
    EXAMINATION_DOCUMENTS("Exams", "SEXM"),
    FINAL_YEAR_PROJECT("Final Year Project", "SFYP");

    private final String displayName;
    private final String folderCode;

    StudentDocumentCategory(String displayName, String folderCode) {
        this.displayName = displayName;
        this.folderCode = folderCode;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getFolderCode() {
        return folderCode;
    }

    public static StudentDocumentCategory from(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Document category is required");
        }
        return StudentDocumentCategory.valueOf(value.trim().toUpperCase());
    }
}
