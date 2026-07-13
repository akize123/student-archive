package com.auca.archive.service;

import com.auca.archive.config.AucaFacultyCatalog;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class StudentIdFormatService {
    public static final String FORMAT_HINT = "YYYY + semester(1-3) + DEPT + SEQ (example: 20251SENG041)";
    public static final String LEGACY_FORMAT_HINT = "5-digit number (example: 25876)";
    public static final String FOLDER_NAME_HINT = FORMAT_HINT;

    private static final Pattern MODERN_ID_PATTERN = Pattern.compile(
            "^(\\d{4})([123])([A-Z]{3,4})(\\d{3})$",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern LEGACY_ID_PATTERN = Pattern.compile("^\\d{5}$");

    private static final Map<String, String> DEPARTMENT_BY_CODE = Map.ofEntries(
            Map.entry("SEN", "Software Engineering"),
            Map.entry("SENG", "Software Engineering"),
            Map.entry("IMA", "Information Management"),
            Map.entry("NET", "Networking & Communication Systems"),
            Map.entry("ACC", "Accounting"),
            Map.entry("MGT", "Management"),
            Map.entry("FIN", "Finance"),
            Map.entry("EPS", "Educational Psychology"),
            Map.entry("LNG", "Languages (English / French)"),
            Map.entry("REL", "Religious Studies"),
            Map.entry("BAC", "Business Accounting & Computer Science"),
            Map.entry("NUR", "Nursing"),
            Map.entry("MID", "Midwifery"),
            Map.entry("THE", "Theology (Pastoral Training)")
    );

    public boolean isModernFormat(String studentNumber) {
        return studentNumber != null && MODERN_ID_PATTERN.matcher(studentNumber.trim()).matches();
    }

    public boolean isLegacyFormat(String studentNumber) {
        return studentNumber != null && LEGACY_ID_PATTERN.matcher(studentNumber.trim()).matches();
    }

    public boolean isRecognizedFormat(String studentNumber) {
        return isModernFormat(studentNumber) || isLegacyFormat(studentNumber);
    }

    public void requireRecognizedFormat(String studentNumber) {
        if (!isRecognizedFormat(studentNumber)) {
            throw new IllegalArgumentException("Student ID must follow " + FORMAT_HINT
                    + " or use a " + LEGACY_FORMAT_HINT + ".");
        }
    }

    public void requireModernFormat(String studentNumber) {
        requireRecognizedFormat(studentNumber);
    }

    public void requireStaffFolderName(String folderName) {
        if (folderName == null || folderName.isBlank()) {
            throw new IllegalArgumentException("Folder name is required");
        }
        String normalized = folderName.trim().toUpperCase(Locale.ROOT);
        Optional<ParsedStudentId> parsed = parse(normalized);
        if (parsed.isEmpty()) {
            throw new IllegalArgumentException("Folder name must be " + FOLDER_NAME_HINT
                    + ". Semester must be 1, 2, or 3.");
        }
        ParsedStudentId value = parsed.get();
        if (value.departmentName() == null) {
            throw new IllegalArgumentException("Unknown department code \"" + value.departmentCode()
                    + "\". Use codes like SENG, NET, IMA, ACC.");
        }
        if (!"1".equals(value.intake()) && !"2".equals(value.intake()) && !"3".equals(value.intake())) {
            throw new IllegalArgumentException("Semester in the folder name must be 1, 2, or 3.");
        }
    }

    public Optional<ParsedStudentId> parse(String studentNumber) {
        if (studentNumber == null || studentNumber.isBlank()) {
            return Optional.empty();
        }
        Matcher matcher = MODERN_ID_PATTERN.matcher(studentNumber.trim());
        if (!matcher.matches()) {
            return Optional.empty();
        }
        String departmentCode = matcher.group(3).toUpperCase(Locale.ROOT);
        return Optional.of(new ParsedStudentId(
                matcher.group(1),
                matcher.group(2),
                departmentCode,
                matcher.group(4),
                DEPARTMENT_BY_CODE.get(departmentCode)
        ));
    }

    public String resolveCohortCode(String studentNumber) {
        return parse(studentNumber)
                .map(parsed -> parsed.admissionYear().substring(2))
                .orElse(null);
    }

    public Optional<String> resolveDepartmentName(String studentNumber) {
        return parse(studentNumber).map(ParsedStudentId::departmentName);
    }

    public Optional<String> resolveFacultyName(String studentNumber) {
        return resolveDepartmentName(studentNumber).flatMap(this::resolveFacultyForDepartment);
    }

    public void validateDepartmentMatch(String studentNumber, String department) {
        if (department == null || department.isBlank()) {
            return;
        }
        parse(studentNumber).ifPresent(parsed -> {
            if (parsed.departmentName() == null) {
                return;
            }
            if (!parsed.departmentName().equalsIgnoreCase(department.trim())) {
                throw new IllegalArgumentException("Student ID department code "
                        + parsed.departmentCode()
                        + " does not match selected department "
                        + department.trim());
            }
        });
    }

    public Map<String, String> departmentCodes() {
        return new LinkedHashMap<>(DEPARTMENT_BY_CODE);
    }

    private Optional<String> resolveFacultyForDepartment(String departmentName) {
        for (AucaFacultyCatalog.FacultyEntry faculty : AucaFacultyCatalog.FACULTIES) {
            boolean matches = faculty.departments().stream()
                    .anyMatch(department -> department.equalsIgnoreCase(departmentName));
            if (matches) {
                return Optional.of(faculty.name());
            }
        }
        return Optional.empty();
    }

    public record ParsedStudentId(
            String admissionYear,
            String intake,
            String departmentCode,
            String sequence,
            String departmentName
    ) {
    }
}
