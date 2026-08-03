package com.auca.archive.domain;

import java.util.List;
import java.util.Optional;

public final class AcademicDepartmentCatalog {
    private static final List<String> DEPARTMENTS = List.of(
            "Accounting",
            "Management",
            "Finance",
            "Networking & Communication Systems",
            "Software Engineering",
            "Information Management",
            "Educational Psychology",
            "Languages (English / French)",
            "Religious Studies",
            "Business Accounting & Computer Science",
            "Nursing",
            "Midwifery",
            "Theology (Pastoral Training)"
    );

    private AcademicDepartmentCatalog() {
    }

    public static List<String> all() {
        return DEPARTMENTS;
    }

    public static boolean isKnownAcademicDepartment(String department) {
        if (department == null || department.isBlank()) {
            return false;
        }
        String trimmed = department.trim();
        return DEPARTMENTS.stream().anyMatch(name -> name.equalsIgnoreCase(trimmed));
    }

    public static Optional<String> canonicalName(String department) {
        if (department == null || department.isBlank()) {
            return Optional.empty();
        }
        String trimmed = department.trim();
        return DEPARTMENTS.stream()
                .filter(name -> name.equalsIgnoreCase(trimmed))
                .findFirst();
    }

    public static void requireValidHodDepartment(String department) {
        if (!isKnownAcademicDepartment(department)) {
            throw new IllegalArgumentException(
                    "Head of Department accounts must use an academic department name from the archive (for example Software Engineering).");
        }
        if (UserRole.HOD.getDepartment().equalsIgnoreCase(department.trim())) {
            throw new IllegalArgumentException(
                    "Please select a real academic department, not the generic department office label.");
        }
    }
}
