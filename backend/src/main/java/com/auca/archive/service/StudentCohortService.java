package com.auca.archive.service;

import org.springframework.stereotype.Service;

@Service
public class StudentCohortService {
    private final StudentIdFormatService studentIdFormatService;

    public StudentCohortService(StudentIdFormatService studentIdFormatService) {
        this.studentIdFormatService = studentIdFormatService;
    }

    /**
     * Modern IDs like 20251SEN001 use admission year 2025 -> cohort "25".
     * Legacy numeric IDs like 25876 still map to cohort "25".
     */
    public String resolveCohortCode(String studentNumber) {
        if (studentNumber == null || studentNumber.isBlank()) {
            return "00";
        }

        String modernCohort = studentIdFormatService.resolveCohortCode(studentNumber);
        if (modernCohort != null) {
            return modernCohort;
        }

        String digits = studentNumber.replaceAll("\\D", "");
        if (digits.length() >= 5) {
            return digits.substring(0, 2);
        }
        if (digits.length() >= 4 && digits.startsWith("20")) {
            return digits.substring(2, 4);
        }
        if (digits.length() >= 2) {
            return digits.substring(0, 2);
        }
        return "00";
    }

    public String resolveCohortFolderName(String studentNumber) {
        return resolveCohortCode(studentNumber) + "'s";
    }
}
