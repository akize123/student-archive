package com.auca.archive.service;

import org.springframework.stereotype.Service;

@Service
public class StudentCohortService {
    /**
     * AUCA student IDs like 25876 belong to cohort "25" (IDs 25000-25999).
     */
    public String resolveCohortCode(String studentNumber) {
        if (studentNumber == null || studentNumber.isBlank()) {
            return "00";
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
