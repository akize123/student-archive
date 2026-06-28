package com.auca.archive.service;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.model.ActivityEntryEntity;
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
        if (role == null) {
            return true;
        }
        String normalizedCode = normalize(folderCode);
        if (normalizedCode == null) {
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
        };
    }

    public List<String> visibleFolderPrefixes(UserRole role) {
        if (role == null) {
            return List.of();
        }

        return switch (role) {
            case ADMIN -> List.of("REG", "SREG", "SRIN", "SAPP", "SEXM", "FLD", "ENR", "EXM", "GRD", "TRN");
            case REGISTRAR -> List.of("REG", "SREG", "SRIN", "SAPP");
            case EXAMINATION_OFFICER -> List.of("SEXM");
            case HOD -> List.of("SAPP");
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
        };
    }

    public boolean isApprovedStatus(DocumentStatus status) {
        return status != null && status == DocumentStatus.APPROVED;
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
