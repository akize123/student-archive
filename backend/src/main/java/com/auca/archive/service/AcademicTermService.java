package com.auca.archive.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AcademicTermService {
    public static final List<String> ACADEMIC_YEARS = List.of(
            "2024-2025",
            "2025-2026",
            "2026-2027",
            "2027-2028",
            "2028-2029"
    );
    public static final int SEMESTERS_PER_YEAR = 3;

    private static final Pattern ACADEMIC_YEAR_PATTERN = Pattern.compile("^(\\d{4})[-/](\\d{4})$");
    private static final Pattern SEMESTER_SLASH_PATTERN = Pattern.compile("^(\\d{4})/(\\d)$");
    private static final Pattern SEMESTER_NUMBER_PATTERN = Pattern.compile("^(?:Semester\\s+)?(\\d)$", Pattern.CASE_INSENSITIVE);

    private final StudentIdFormatService studentIdFormatService;
    private final StudentCohortService cohortService;

    public AcademicTermService(StudentIdFormatService studentIdFormatService, StudentCohortService cohortService) {
        this.studentIdFormatService = studentIdFormatService;
        this.cohortService = cohortService;
    }

    public String normalizeAcademicYear(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String trimmed = raw.trim().replace('/', '-');
        Matcher matcher = ACADEMIC_YEAR_PATTERN.matcher(trimmed);
        if (!matcher.matches()) {
            return null;
        }
        return matcher.group(1) + "-" + matcher.group(2);
    }

    public int parseStartYear(String academicYear) {
        String normalized = normalizeAcademicYear(academicYear);
        if (normalized == null) {
            throw new IllegalArgumentException("Academic year must use the format 2025-2026");
        }
        return Integer.parseInt(normalized.substring(0, 4));
    }

    public String formatAcademicYearRange(int startYear) {
        return startYear + "-" + (startYear + 1);
    }

    public String formatSemesterFolderName(int startYear, int semesterNumber) {
        return startYear + "/" + semesterNumber;
    }

    public String buildAcademicYearFolderCode(String departmentCode, String academicYear) {
        String normalized = normalizeAcademicYear(academicYear);
        if (normalized == null) {
            throw new IllegalArgumentException("Academic year must use the format 2025-2026");
        }
        int startYear = parseStartYear(normalized);
        int endYear = startYear + 1;
        return departmentCode + "-AY-" + startYear + endYear;
    }

    public String buildSemesterFolderCode(String academicYearFolderCode, int startYear, int semesterNumber) {
        return academicYearFolderCode + "-SEM-" + startYear + "-" + semesterNumber;
    }

    public ResolvedTerm resolveTerm(String studentNumber, String academicYearOverride, String semesterOverride) {
        String academicYear = normalizeAcademicYear(academicYearOverride);
        Integer semesterNumber = parseSemesterNumber(semesterOverride, academicYear);
        Integer startYear = academicYear == null ? null : parseStartYear(academicYear);

        if (startYear == null || semesterNumber == null) {
            var parsed = studentIdFormatService.parse(studentNumber);
            if (parsed.isPresent()) {
                if (startYear == null) {
                    startYear = Integer.parseInt(parsed.get().admissionYear());
                    academicYear = formatAcademicYearRange(startYear);
                }
                if (semesterNumber == null) {
                    semesterNumber = Integer.parseInt(parsed.get().intake());
                }
            } else if (studentNumber != null && !studentNumber.isBlank()) {
                if (startYear == null) {
                    String cohortCode = cohortService.resolveCohortCode(studentNumber);
                    startYear = 2000 + Integer.parseInt(cohortCode);
                    academicYear = formatAcademicYearRange(startYear);
                }
                if (semesterNumber == null) {
                    semesterNumber = 1;
                }
            }
        }

        if (academicYear == null || semesterNumber == null) {
            throw new IllegalArgumentException("Academic year and semester are required to place this document in the archive tree");
        }
        if (semesterNumber < 1 || semesterNumber > SEMESTERS_PER_YEAR) {
            throw new IllegalArgumentException("Semester must be between 1 and " + SEMESTERS_PER_YEAR);
        }

        return new ResolvedTerm(
                academicYear,
                startYear,
                semesterNumber,
                formatSemesterFolderName(startYear, semesterNumber)
        );
    }

    public Integer parseSemesterNumber(String raw, String academicYear) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String trimmed = raw.trim();
        Matcher slashMatcher = SEMESTER_SLASH_PATTERN.matcher(trimmed);
        if (slashMatcher.matches()) {
            return Integer.parseInt(slashMatcher.group(2));
        }
        Matcher numberMatcher = SEMESTER_NUMBER_PATTERN.matcher(trimmed);
        if (numberMatcher.matches()) {
            return Integer.parseInt(numberMatcher.group(1));
        }
        return null;
    }

    public String studentFolderMarker(String studentNumber) {
        if (studentNumber == null || studentNumber.isBlank()) {
            return null;
        }
        return "-STU-" + sanitizeCode(studentNumber);
    }

    private String sanitizeCode(String value) {
        return value.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }

    public record ResolvedTerm(
            String academicYear,
            int startYear,
            int semesterNumber,
            String semesterFolderName
    ) {
    }
}
