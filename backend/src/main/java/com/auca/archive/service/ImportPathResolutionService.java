package com.auca.archive.service;

import com.auca.archive.dto.ImportPreviewItemResponse;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.repository.FolderRepository;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ImportPathResolutionService {
    private static final Pattern SEMESTER_NAME_PATTERN = Pattern.compile("^(\\d{4})/(\\d)$");

    private final StudentIdFormatService studentIdFormatService;
    private final StudentService studentService;
    private final FolderRepository folderRepository;
    private final DocumentTextExtractionService textExtractionService;

    public ImportPathResolutionService(
            StudentIdFormatService studentIdFormatService,
            StudentService studentService,
            FolderRepository folderRepository,
            DocumentTextExtractionService textExtractionService
    ) {
        this.studentIdFormatService = studentIdFormatService;
        this.studentService = studentService;
        this.folderRepository = folderRepository;
        this.textExtractionService = textExtractionService;
    }

    public ImportPreviewItemResponse resolveItem(
            String relativePath,
            String fileName,
            FolderEntity targetFolder,
            String faculty,
            String department,
            String academicYear,
            String semester
    ) {
        return resolveItem(relativePath, fileName, targetFolder, faculty, department, academicYear, semester, null);
    }

    public ImportPreviewItemResponse resolveItem(
            String relativePath,
            String fileName,
            FolderEntity targetFolder,
            String faculty,
            String department,
            String academicYear,
            String semester,
            byte[] pdfBytes
    ) {
        List<String> warnings = new ArrayList<>();
        List<String> conflicts = new ArrayList<>();
        String normalizedPath = relativePath.replace('\\', '/');
        int slashIndex = normalizedPath.lastIndexOf('/');
        String directoryPath = slashIndex >= 0 ? normalizedPath.substring(0, slashIndex) : "";

        String candidateId = null;
        String resolutionSource = "manualRequired";

        if (!directoryPath.isBlank()) {
            for (String segment : directoryPath.split("/")) {
                if (segment == null || segment.isBlank()) {
                    continue;
                }
                String trimmed = segment.trim();
                if (studentIdFormatService.isRecognizedFormat(trimmed)) {
                    candidateId = trimmed.toUpperCase(Locale.ROOT);
                    resolutionSource = "folderSegment";
                    if (studentIdFormatService.isLegacyFormat(trimmed)) {
                        warnings.add("Legacy student folder name detected: " + trimmed);
                    }
                }
            }
        }

        if (candidateId == null) {
            Optional<String> fromFileName = studentIdFormatService.findRecognizedIdInFileName(fileName);
            if (fromFileName.isPresent()) {
                candidateId = fromFileName.get();
                resolutionSource = "fileName";
                warnings.add("Student ID inferred from file name");
            }
        }

        String suggestedStudentName = null;
        if (pdfBytes != null && pdfBytes.length > 0) {
            try {
                DocumentTextExtractionService.ExtractionResult extraction = textExtractionService.extractFromPdf(pdfBytes);
                if (candidateId == null) {
                    Optional<String> fromText = studentIdFormatService.findRecognizedIdInText(extraction.text());
                    if (fromText.isPresent()) {
                        candidateId = fromText.get();
                        resolutionSource = "pdfText";
                        warnings.add("Student ID inferred from PDF text");
                    }
                }
                suggestedStudentName = inferStudentNameFromText(extraction.text());
                if (suggestedStudentName != null) {
                    warnings.add("Student name inferred from PDF text");
                }
            } catch (IOException ignored) {
                warnings.add("Could not extract PDF text for student matching");
            }
        }

        String suggestedFolderName = candidateId;
        if (candidateId != null && studentIdFormatService.isLegacyFormat(candidateId)) {
            Optional<String> inferredModern = inferModernFromLegacy(candidateId, department, academicYear, semester);
            if (inferredModern.isPresent()) {
                suggestedFolderName = inferredModern.get();
                resolutionSource = "inferredFromContext";
                warnings.add("Suggested modern ID from semester folder context");
            } else {
                warnings.add("Enter a modern student folder name (example: 20251SENG041)");
            }
        } else if (candidateId != null && studentIdFormatService.isModernFormat(candidateId)) {
            suggestedFolderName = candidateId.toUpperCase(Locale.ROOT);
        } else if (candidateId == null) {
            suggestedFolderName = "";
            warnings.add("Could not determine student folder automatically");
        }

        if (suggestedFolderName != null && !suggestedFolderName.isBlank()) {
            try {
                studentIdFormatService.requireStaffFolderName(suggestedFolderName);
            } catch (IllegalArgumentException ex) {
                if (!warnings.contains(ex.getMessage())) {
                    warnings.add(ex.getMessage());
                }
            }
        }

        if (suggestedFolderName != null && !suggestedFolderName.isBlank()) {
            conflicts.addAll(studentService.detectConflicts(
                    suggestedFolderName,
                    null,
                    faculty,
                    department,
                    true
            ));
        }

        String proposedTitle = stripExtension(sanitizeFileName(fileName));
        return new ImportPreviewItemResponse(
                relativePath,
                suggestedFolderName == null ? "" : suggestedFolderName,
                suggestedFolderName,
                suggestedStudentName,
                resolutionSource,
                proposedTitle,
                warnings,
                conflicts,
                null,
                null
        );
    }

    public Map<String, List<ImportPreviewItemResponse>> groupByStudent(List<ImportPreviewItemResponse> items) {
        Map<String, List<ImportPreviewItemResponse>> groups = new LinkedHashMap<>();
        for (ImportPreviewItemResponse item : items) {
            String key = item.suggestedFolderName() == null || item.suggestedFolderName().isBlank()
                    ? "Unassigned"
                    : item.suggestedFolderName().trim().toUpperCase(Locale.ROOT);
            groups.computeIfAbsent(key, ignored -> new ArrayList<>()).add(item);
        }
        return groups;
    }

    private String inferStudentNameFromText(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Pattern namePattern = Pattern.compile("(?:Name|Student Name|Full Name)\\s*[:\\-]\\s*([A-Za-z][A-Za-z .'-]{2,80})", Pattern.CASE_INSENSITIVE);
        Matcher matcher = namePattern.matcher(text);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        return null;
    }

    public ArchiveFolderContext resolveFolderContext(FolderEntity folder) {
        String faculty = "";
        String department = "";
        String academicYear = "";
        String semester = "";
        FolderEntity current = folder;
        Map<Long, FolderEntity> visited = new LinkedHashMap<>();
        while (current != null && !visited.containsKey(current.getId())) {
            visited.put(current.getId(), current);
            String code = current.getCode() == null ? "" : current.getCode().toUpperCase(Locale.ROOT);
            String name = current.getName() == null ? "" : current.getName().trim();
            if (code.matches("^FAC-[A-Z0-9]+$")) {
                faculty = name;
            }
            if (code.matches("^FAC-[A-Z0-9]+-DEPT-[A-Z0-9]+$")) {
                department = name;
            }
            if (code.matches(".*-AY-\\d{8}$") || name.matches("^\\d{4}-\\d{4}$")) {
                academicYear = name;
            }
            if ((code.contains("-SEM-") && !code.contains("-STU-")) || name.matches("^\\d{4}/\\d$")) {
                semester = name;
            }
            if (current.getParentId() == null) {
                break;
            }
            current = folderRepository.findById(current.getParentId()).orElse(null);
        }
        return new ArchiveFolderContext(faculty, department, academicYear, semester);
    }

    private Optional<String> inferModernFromLegacy(
            String legacyId,
            String departmentName,
            String academicYear,
            String semesterName
    ) {
        if (departmentName == null || departmentName.isBlank()) {
            return Optional.empty();
        }
        Optional<String> departmentCode = resolveDepartmentCode(departmentName);
        if (departmentCode.isEmpty()) {
            return Optional.empty();
        }

        String admissionYear = extractAdmissionYear(academicYear, semesterName);
        String semesterDigit = extractSemesterDigit(semesterName);
        if (admissionYear == null || semesterDigit == null) {
            return Optional.empty();
        }

        String sequence = legacyId.length() >= 3
                ? legacyId.substring(legacyId.length() - 3)
                : String.format("%03d", Integer.parseInt(legacyId));
        return Optional.of(admissionYear + semesterDigit + departmentCode.get() + sequence);
    }

    private Optional<String> resolveDepartmentCode(String departmentName) {
        for (Map.Entry<String, String> entry : studentIdFormatService.departmentCodes().entrySet()) {
            if (entry.getValue().equalsIgnoreCase(departmentName.trim())) {
                return Optional.of(entry.getKey());
            }
        }
        return Optional.empty();
    }

    private String extractAdmissionYear(String academicYear, String semesterName) {
        if (semesterName != null && !semesterName.isBlank()) {
            Matcher matcher = SEMESTER_NAME_PATTERN.matcher(semesterName.trim());
            if (matcher.matches()) {
                return matcher.group(1);
            }
        }
        if (academicYear != null && academicYear.matches("^\\d{4}-\\d{4}$")) {
            return academicYear.substring(0, 4);
        }
        return null;
    }

    private String extractSemesterDigit(String semesterName) {
        if (semesterName == null || semesterName.isBlank()) {
            return null;
        }
        Matcher matcher = SEMESTER_NAME_PATTERN.matcher(semesterName.trim());
        if (matcher.matches()) {
            return matcher.group(2);
        }
        return null;
    }

    private String sanitizeFileName(String fileName) {
        return fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String stripExtension(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex <= 0) {
            return fileName;
        }
        return fileName.substring(0, dotIndex);
    }

    public record ArchiveFolderContext(
            String faculty,
            String department,
            String academicYear,
            String semester
    ) {
    }
}
