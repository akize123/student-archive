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
        if (role == null) {
            return false;
        }
        if (category == null) {
            return role == UserRole.REGISTRAR || role == UserRole.HOD;
        }
        return allowedUploadCategories(role).contains(category);
    }

    public boolean isActivityRelevant(ActivityEntryEntity activity, UserRole role) {
        return isActivityVisible(activity, role, null, null);
    }

    public boolean isActivityVisible(
            ActivityEntryEntity activity,
            UserRole viewerRole,
            String viewerDepartment,
            String viewerStudentNumber
    ) {
        if (activity == null) {
            return false;
        }
        if (viewerRole == null) {
            return true;
        }
        if (viewerRole == UserRole.ADMIN) {
            return true;
        }

        if (!hasScopeMetadata(activity)) {
            return false;
        }

        if (viewerRole == UserRole.STUDENT) {
            if (activity.getSourceRole() == viewerRole || activity.getTargetRole() == viewerRole) {
                return matchesStudentNumber(activity.getStudentNumber(), viewerStudentNumber);
            }
            return matchesStudentNumber(activity.getStudentNumber(), viewerStudentNumber);
        }

        if (viewerRole == UserRole.HOD) {
            if (activity.getSourceRole() == viewerRole || activity.getTargetRole() == viewerRole) {
                return matchesDepartment(activity.getAcademicDepartment(), viewerDepartment);
            }
            return matchesDepartment(activity.getAcademicDepartment(), viewerDepartment);
        }

        if (activity.getSourceRole() == viewerRole || activity.getTargetRole() == viewerRole) {
            return true;
        }

        if (activity.getCategory() == ActivityCategory.SHARE) {
            return false;
        }

        if (viewerRole == UserRole.REGISTRAR
                || viewerRole == UserRole.EXAMINATION_OFFICER
                || viewerRole == UserRole.LIBRARIAN) {
            return false;
        }

        if (activity.getDocumentCategory() != null) {
            return allowedUploadCategories(viewerRole).contains(activity.getDocumentCategory());
        }

        if (activity.getCategory() == ActivityCategory.SYNC) {
            return activity.getSourceRole() == viewerRole;
        }

        return false;
    }

    public boolean canViewOfficeDocument(DocumentEntity document, UserRole viewerRole) {
        if (document == null || viewerRole == null) {
            return false;
        }
        if (viewerRole == UserRole.ADMIN) {
            return true;
        }
        if (viewerRole == UserRole.STUDENT) {
            return false;
        }

        UserRole ownerRole = document.getUploadedByRole();
        if (ownerRole != null) {
            if (viewerRole == ownerRole) {
                return true;
            }
            return viewerRole == UserRole.LIBRARIAN
                    && ownerRole == UserRole.STUDENT
                    && document.getCategory() == StudentDocumentCategory.FINAL_YEAR_PROJECT;
        }

        StudentDocumentCategory category = document.getCategory();
        if (category == null) {
            return false;
        }

        return switch (category) {
            case REGISTRATION_FORM, REINTEGRATION_FORM -> viewerRole == UserRole.REGISTRAR;
            case EXAMINATION_DOCUMENTS -> viewerRole == UserRole.EXAMINATION_OFFICER;
            case APPLICATION_DOCUMENTS -> viewerRole == UserRole.REGISTRAR || viewerRole == UserRole.HOD;
            case FINAL_YEAR_PROJECT -> viewerRole == UserRole.LIBRARIAN || viewerRole == UserRole.STUDENT;
        };
    }

    public boolean isOfficeStaffRole(UserRole role) {
        return role == UserRole.REGISTRAR
                || role == UserRole.EXAMINATION_OFFICER
                || role == UserRole.HOD
                || role == UserRole.LIBRARIAN;
    }

    private boolean hasScopeMetadata(ActivityEntryEntity activity) {
        return activity.getSourceRole() != null
                || activity.getTargetRole() != null
                || activity.getDocumentCategory() != null
                || activity.getAcademicDepartment() != null
                || activity.getStudentNumber() != null;
    }

    private boolean matchesStudentNumber(String activityStudentNumber, String viewerStudentNumber) {
        if (activityStudentNumber == null || activityStudentNumber.isBlank()) {
            return false;
        }
        if (viewerStudentNumber == null || viewerStudentNumber.isBlank()) {
            return false;
        }
        return activityStudentNumber.trim().equalsIgnoreCase(viewerStudentNumber.trim());
    }

    private boolean matchesDepartment(String activityDepartment, String viewerDepartment) {
        if (activityDepartment == null || activityDepartment.isBlank()) {
            return false;
        }
        if (viewerDepartment == null || viewerDepartment.isBlank()) {
            return false;
        }
        return activityDepartment.trim().equalsIgnoreCase(viewerDepartment.trim());
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

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }
}
