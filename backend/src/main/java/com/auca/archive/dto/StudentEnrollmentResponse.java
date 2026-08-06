package com.auca.archive.dto;

public record StudentEnrollmentResponse(
        boolean registered,
        String studentNumber,
        String studentName,
        String faculty,
        String department,
        Long registrarFolderId
) {
    public static StudentEnrollmentResponse notRegistered(String studentNumber) {
        return new StudentEnrollmentResponse(
                false,
                studentNumber,
                null,
                null,
                null,
                null
        );
    }
}
