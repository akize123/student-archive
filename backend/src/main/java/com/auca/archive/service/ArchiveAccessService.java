package com.auca.archive.service;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.model.ActivityEntryEntity;
import com.auca.archive.model.DocumentEntity;
import com.auca.archive.model.FolderEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class ArchiveAccessService {
    public UserRole resolveRole(String rawRole) {
        if (rawRole == null || rawRole.isBlank()) {
            throw new IllegalArgumentException("User role header is required");
        }
        try {
            return UserRole.valueOf(rawRole.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unsupported role: " + rawRole);
        }
    }

    public boolean matchesRoleFolderCode(String folderCode, UserRole role) {
        if (role == UserRole.ADMIN) {
            return true;
        }
        if (role == UserRole.STUDENT) {
            return false;
        }
        if (role == null) {
            return true;
        }
        String normalizedCode = normalize(folderCode);
        if (normalizedCode == null) {
            return false;
        }
        if (role != UserRole.LIBRARIAN && ArchiveTreeService.isLibrarianReviewFolderCode(normalizedCode)) {
            return false;
        }
        return visibleFolderPrefixes(role).stream().anyMatch(normalizedCode::startsWith);
    }

    public boolean canUploadCategory(UserRole role, StudentDocumentCategory category) {
        if (role == null || category == null) {
            return true;
        }
        return allowedUploadCategories(role).contains(category);
    }

    public boolean isActivityRelevant(ActivityEntryEntity activity, UserRole role) {
        if (activity == null || role == null) {
            return true;
        }

        String haystack = String.join(" ",
                safe(activity.getMessage()),
                safe(activity.getActor()),
                activity.getCategory() == null ? "" : activity.getCategory().name()
        ).toLowerCase(Locale.ROOT);

        return switch (role) {
            case ADMIN -> true;
            case REGISTRAR -> containsAny(haystack, "registrar", "registration", "enrollment", "transcript", "graduation", "admission");
            case EXAMINATION_OFFICER -> containsAny(haystack, "exam", "marks", "grading", "paper", "semester", "mid-sem", "final");
            case HOD -> containsAny(haystack, "hod", "department", "thesis", "approval", "faculty");
            case LIBRARIAN -> containsAny(haystack, "library", "librarian", "project", "thesis", "final year", "fyp", "approval", "student");
            case STUDENT -> containsAny(haystack, "student", "registration", "registrar", "project", "final year", "application", "reintegration");
        };
    }

    public List<String> visibleFolderPrefixes(UserRole role) {
        if (role == null) {
            return List.of();
        }

        return switch (role) {
            case ADMIN -> List.of("AUCA", "FAC", "AY", "SEM", "REG", "SREG", "SRIN", "SAPP", "SEXM", "FLD", "ENR", "EXM", "GRD", "TRN", "STD", "SFYP", "SOFF", "SMY");
            case REGISTRAR -> List.of("AUCA", "FAC", "AY", "SEM", "REG", "SREG", "SRIN", "SAPP", "FLD", "STD", "SOFF");
            case EXAMINATION_OFFICER -> List.of("AUCA", "FAC", "AY", "SEM", "SEXM", "FLD", "STD", "SOFF");
            case HOD -> List.of("AUCA", "FAC", "AY", "SEM", "SAPP", "FLD", "STD", "SOFF", "SMY");
            case LIBRARIAN -> List.of("AUCA", "FAC", "AY", "SEM", "STD", "SFYP", "FLD", "SMY", "SOFF", "SARC", "LIB", "FYP", "ACC", "REJ");
            case STUDENT -> List.of("STD", "SFYP", "SREG", "SRIN", "SAPP", "SOFF", "SMY", "SARC", "MY", "PRF");
        };
    }

    public Set<StudentDocumentCategory> allowedUploadCategories(UserRole role) {
        if (role == null) {
            return Set.of();
        }

        return switch (role) {
            case ADMIN -> Set.of(StudentDocumentCategory.values());
            case REGISTRAR -> Set.of(
                    StudentDocumentCategory.REGISTRATION_FORM,
                    StudentDocumentCategory.REINTEGRATION_FORM,
                    StudentDocumentCategory.APPLICATION_DOCUMENTS
            );
            case EXAMINATION_OFFICER -> Set.of(StudentDocumentCategory.EXAMINATION_DOCUMENTS);
            case HOD -> Set.of(StudentDocumentCategory.APPLICATION_DOCUMENTS);
            case LIBRARIAN -> Set.of(StudentDocumentCategory.FINAL_YEAR_PROJECT);
            case STUDENT -> Set.of(StudentDocumentCategory.FINAL_YEAR_PROJECT);
        };
    }

    public boolean isApprovedStatus(DocumentStatus status) {
        return status != null && status == DocumentStatus.APPROVED;
    }

    public void requireAdmin(UserRole role) {
        if (role != UserRole.ADMIN) {
            throw new IllegalArgumentException("Only the system administrator can permanently delete archived files");
        }
    }

    public boolean isStudentDocument(DocumentEntity document, String studentNumber) {
        if (document == null || studentNumber == null || studentNumber.isBlank()) {
            return false;
        }
        return document.getStudentNumber() != null
                && document.getStudentNumber().trim().equalsIgnoreCase(studentNumber.trim());
    }

    public boolean isStudentFolder(FolderEntity folder, String studentNumber) {
        if (folder == null || studentNumber == null || studentNumber.isBlank()) {
            return false;
        }
        String marker = studentFolderMarker(studentNumber);
        String code = folder.getCode() == null ? "" : folder.getCode().toUpperCase(Locale.ROOT);
        return code.contains(marker);
    }

    public String studentFolderMarker(String studentNumber) {
        return "-STU-" + sanitizeStudentCode(studentNumber);
    }

    public void requireStudentAccount(UserRole role, String studentNumber) {
        if (role == UserRole.STUDENT && (studentNumber == null || studentNumber.isBlank())) {
            throw new IllegalArgumentException("This student account is not linked to a student ID");
        }
    }

    public void requireOwnStudentNumber(UserRole role, String sessionStudentNumber, String requestedStudentNumber) {
        if (role != UserRole.STUDENT) {
            return;
        }
        requireStudentAccount(role, sessionStudentNumber);
        if (requestedStudentNumber == null
                || !requestedStudentNumber.trim().equalsIgnoreCase(sessionStudentNumber.trim())) {
            throw new IllegalArgumentException("You can only access your own student records");
        }
    }

    private String sanitizeStudentCode(String value) {
        if (value == null || value.isBlank()) {
            return "UNKNOWN";
        }
        return value.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }

    private boolean containsAny(String haystack, String... terms) {
        for (String term : terms) {
            if (haystack.contains(term)) {
                return true;
            }
        }
        return false;
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
