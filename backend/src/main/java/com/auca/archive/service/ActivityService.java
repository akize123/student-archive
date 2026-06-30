package com.auca.archive.service;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.ActivityResponse;
import com.auca.archive.model.ActivityEntryEntity;
import com.auca.archive.repository.ActivityEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
public class ActivityService {
    private final ActivityEntryRepository activityEntryRepository;
    private final ArchiveAccessService accessService;

    public ActivityService(ActivityEntryRepository activityEntryRepository, ArchiveAccessService accessService) {
        this.activityEntryRepository = activityEntryRepository;
        this.accessService = accessService;
    }

    public List<ActivityResponse> recent() {
        return recent(null, null, null);
    }

    public List<ActivityResponse> recent(String rawRole) {
        return recent(rawRole, null, null);
    }

    public List<ActivityResponse> recent(String rawRole, String scopeRole, String topic) {
        UserRole viewerRole = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        UserRole scope = scopeRole == null || scopeRole.isBlank()
                ? viewerRole
                : accessService.resolveRole(scopeRole);

        if (viewerRole == UserRole.ADMIN && scopeRole != null && !scopeRole.isBlank()) {
            scope = accessService.resolveRole(scopeRole);
        }

        final UserRole filterRole = scope;
        return activityEntryRepository.findTop50ByOrderByCreatedAtDesc()
                .stream()
                .filter(entry -> accessService.isActivityRelevant(entry, filterRole))
                .filter(entry -> matchesTopic(entry, topic))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ActivityResponse recordShare(String folderName, String actor, UserRole targetRole) {
        String targetLabel = roleLabel(targetRole);
        ActivityEntryEntity entry = new ActivityEntryEntity();
        entry.setMessage("Shared folder \"" + folderName + "\" with " + targetLabel);
        entry.setActor(actor == null || actor.isBlank() ? "Archive user" : actor.trim());
        entry.setCategory(ActivityCategory.SHARE);
        entry.setCreatedAt(LocalDateTime.now());
        return toResponse(activityEntryRepository.save(entry));
    }

    private boolean matchesTopic(ActivityEntryEntity entry, String topic) {
        if (topic == null || topic.isBlank()) {
            return true;
        }

        String haystack = String.join(" ",
                safe(entry.getMessage()),
                safe(entry.getActor()),
                entry.getCategory() == null ? "" : entry.getCategory().name()
        ).toLowerCase(Locale.ROOT);

        try {
            StudentDocumentCategory category = StudentDocumentCategory.valueOf(topic.trim().toUpperCase(Locale.ROOT));
            return switch (category) {
                case REGISTRATION_FORM -> containsAny(haystack, "registration", "enroll", "registrar", "sreg", "transcript");
                case REINTEGRATION_FORM -> containsAny(haystack, "reintegration", "reinstate", "srin", "re-entry");
                case APPLICATION_DOCUMENTS -> containsAny(haystack, "application", "admission", "sapp", "thesis", "approval");
                case EXAMINATION_DOCUMENTS -> containsAny(haystack, "exam", "marks", "grading", "sexm", "paper", "semester");
            };
        } catch (IllegalArgumentException ex) {
            return haystack.contains(topic.trim().toLowerCase(Locale.ROOT));
        }
    }

    private ActivityResponse toResponse(ActivityEntryEntity entry) {
        return new ActivityResponse(
                entry.getId(),
                entry.getMessage(),
                entry.getActor(),
                entry.getCategory() == null ? "" : entry.getCategory().name(),
                entry.getCreatedAt()
        );
    }

    private String roleLabel(UserRole role) {
        if (role == null) {
            return "Archive user";
        }
        return switch (role) {
            case ADMIN -> "System Administrator";
            case REGISTRAR -> "Registrar";
            case EXAMINATION_OFFICER -> "Examination Officer";
            case HOD -> "Head of Department";
        };
    }

    private boolean containsAny(String haystack, String... terms) {
        for (String term : terms) {
            if (haystack.contains(term)) {
                return true;
            }
        }
        return false;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
