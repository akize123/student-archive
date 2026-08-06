package com.auca.archive.domain;

import com.auca.archive.config.AucaFacultyCatalog;

import java.util.List;
import java.util.Optional;

public final class FacultyCatalog {
    private FacultyCatalog() {
    }

    public static List<String> allFacultyNames() {
        return AucaFacultyCatalog.FACULTIES.stream()
                .map(AucaFacultyCatalog.FacultyEntry::name)
                .toList();
    }

    public static boolean isKnownFaculty(String faculty) {
        if (faculty == null || faculty.isBlank()) {
            return false;
        }
        String trimmed = faculty.trim();
        return AucaFacultyCatalog.FACULTIES.stream()
                .anyMatch(entry -> entry.name().equalsIgnoreCase(trimmed));
    }

    public static Optional<String> canonicalFacultyName(String faculty) {
        if (faculty == null || faculty.isBlank()) {
            return Optional.empty();
        }
        String trimmed = faculty.trim();
        return AucaFacultyCatalog.FACULTIES.stream()
                .map(AucaFacultyCatalog.FacultyEntry::name)
                .filter(name -> name.equalsIgnoreCase(trimmed))
                .findFirst();
    }

    public static List<String> departmentsForFaculty(String faculty) {
        return canonicalFacultyName(faculty)
                .flatMap(canonical -> AucaFacultyCatalog.FACULTIES.stream()
                        .filter(entry -> entry.name().equalsIgnoreCase(canonical))
                        .findFirst())
                .map(AucaFacultyCatalog.FacultyEntry::departments)
                .orElse(List.of());
    }

    public static boolean isDepartmentInFaculty(String department, String faculty) {
        if (department == null || department.isBlank() || faculty == null || faculty.isBlank()) {
            return false;
        }
        String trimmedDepartment = department.trim();
        return departmentsForFaculty(faculty).stream()
                .anyMatch(name -> name.equalsIgnoreCase(trimmedDepartment));
    }

    /** Faculty that owns an academic department (e.g. Software Engineering → Faculty of Information Technology). */
    public static Optional<String> facultyForDepartment(String department) {
        if (department == null || department.isBlank()) {
            return Optional.empty();
        }
        String trimmedDepartment = department.trim();
        return AucaFacultyCatalog.FACULTIES.stream()
                .filter(entry -> entry.departments().stream()
                        .anyMatch(name -> name.equalsIgnoreCase(trimmedDepartment)))
                .map(AucaFacultyCatalog.FacultyEntry::name)
                .findFirst();
    }

    public static void requireValidDeanFaculty(String faculty) {
        if (!isKnownFaculty(faculty)) {
            throw new IllegalArgumentException(
                    "Dean of Faculty accounts must be linked to a faculty from the archive catalog "
                            + "(for example Faculty of Information Technology).");
        }
        if (UserRole.DEAN_OF_FACULTY.getDepartment().equalsIgnoreCase(faculty.trim())) {
            throw new IllegalArgumentException(
                    "Please select a real faculty name, not the generic faculty office label.");
        }
    }
}
