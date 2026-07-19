package com.auca.archive.service;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.ActivityResponse;
import com.auca.archive.dto.ActivityScope;
import com.auca.archive.dto.AdminActivityPageResponse;
import com.auca.archive.dto.RequestActor;
import com.auca.archive.model.ActivityEntryEntity;
import com.auca.archive.repository.ActivityEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

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
        return recent(null, null, null, null, null);
    }

    public List<ActivityResponse> recent(String rawRole) {
        return recent(rawRole, null, null, null, null);
    }

    public List<ActivityResponse> recent(String rawRole, String scopeRole, String topic) {
        return recent(rawRole, scopeRole, topic, null, null);
    }

    public List<ActivityResponse> recent(
            String rawRole,
            String scopeRole,
            String topic,
            String viewerDepartment,
            String viewerStudentNumber
    ) {
        UserRole viewerRole = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        UserRole scope = scopeRole == null || scopeRole.isBlank()
                ? viewerRole
                : accessService.resolveRole(scopeRole);

        if (viewerRole == UserRole.ADMIN && scopeRole != null && !scopeRole.isBlank()) {
            scope = accessService.resolveRole(scopeRole);
        }

        final UserRole filterRole = scope;
        String department = viewerDepartment == null || viewerDepartment.isBlank() ? null : viewerDepartment.trim();
        String studentNumber = viewerStudentNumber == null || viewerStudentNumber.isBlank()
                ? null
                : viewerStudentNumber.trim();

        return activityEntryRepository.findTop50ByOrderByCreatedAtDesc()
                .stream()
                .filter(entry -> accessService.isActivityVisible(entry, filterRole, department, studentNumber))
                .filter(entry -> matchesTopic(entry, topic))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ActivityResponse recordAction(String message, String actor, ActivityCategory category) {
        return recordAction(message, actor, category, ActivityScope.empty());
    }

    @Transactional
    public ActivityResponse recordAction(String message, String actor, ActivityCategory category, ActivityScope scope) {
        return recordAction(message, actor, category, scope, RequestActor.empty());
    }

    @Transactional
    public ActivityResponse recordAction(
            String message,
            String actor,
            ActivityCategory category,
            ActivityScope scope,
            RequestActor requestActor
    ) {
        ActivityEntryEntity entry = new ActivityEntryEntity();
        entry.setMessage(message);
        entry.setActor(resolveActorLabel(actor, requestActor));
        entry.setCategory(category == null ? ActivityCategory.ARCHIVE : category);
        entry.setCreatedAt(LocalDateTime.now());
        applyScope(entry, scope, requestActor);
        return toResponse(activityEntryRepository.save(entry));
    }

    @Transactional
    public ActivityResponse recordShare(
            String itemName,
            String actor,
            UserRole sourceRole,
            UserRole targetRole,
            String academicDepartment
    ) {
        return recordShare(itemName, actor, sourceRole, targetRole, academicDepartment, RequestActor.empty());
    }

    @Transactional
    public ActivityResponse recordShare(
            String itemName,
            String actor,
            UserRole sourceRole,
            UserRole targetRole,
            String academicDepartment,
            RequestActor requestActor
    ) {
        String targetLabel = roleLabel(targetRole);
        ActivityEntryEntity entry = new ActivityEntryEntity();
        entry.setMessage("Shared folder \"" + itemName + "\" with " + targetLabel);
        entry.setActor(resolveActorLabel(actor, requestActor));
        entry.setCategory(ActivityCategory.SHARE);
        entry.setCreatedAt(LocalDateTime.now());
        ActivityScope scope = ActivityScope.builder()
                .sourceRole(sourceRole)
                .targetRole(targetRole)
                .academicDepartment(academicDepartment)
                .build();
        applyScope(entry, scope, requestActor);
        return toResponse(activityEntryRepository.save(entry));
    }

    public AdminActivityPageResponse adminActivity(
            String scopeRole,
            Long userId,
            String category,
            int page,
            int size
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Pageable pageable = PageRequest.of(safePage, safeSize);

        UserRole role = scopeRole == null || scopeRole.isBlank() ? null : accessService.resolveRole(scopeRole);
        ActivityCategory activityCategory = parseCategory(category);
        Page<ActivityEntryEntity> result = activityEntryRepository.findFiltered(role, userId, activityCategory, pageable);
        List<ActivityResponse> items = result.getContent().stream().map(this::toResponse).toList();
        return new AdminActivityPageResponse(items, result.getTotalElements(), safePage, safeSize);
    }

    public List<ActivityResponse> adminRecent(int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        return activityEntryRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, safeLimit))
                .getContent()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private ActivityCategory parseCategory(String category) {
        if (category == null || category.isBlank()) {
            return null;
        }
        try {
            return ActivityCategory.valueOf(category.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private void applyScope(ActivityEntryEntity entry, ActivityScope scope, RequestActor requestActor) {
        if (scope != null) {
            entry.setSourceRole(scope.sourceRole());
            entry.setTargetRole(scope.targetRole());
            entry.setAcademicDepartment(scope.academicDepartment());
            entry.setDocumentCategory(scope.documentCategory());
            entry.setStudentNumber(scope.studentNumber());
            if (scope.actorAccountId() != null) {
                entry.setActorAccountId(scope.actorAccountId());
            }
            if (scope.actorUsername() != null && !scope.actorUsername().isBlank()) {
                entry.setActorUsername(scope.actorUsername());
            }
        }
        if (requestActor != null) {
            if (entry.getActorAccountId() == null && requestActor.accountId() != null) {
                entry.setActorAccountId(requestActor.accountId());
            }
            if ((entry.getActorUsername() == null || entry.getActorUsername().isBlank())
                    && requestActor.username() != null
                    && !requestActor.username().isBlank()) {
                entry.setActorUsername(requestActor.username());
            }
        }
    }

    private String resolveActorLabel(String actor, RequestActor requestActor) {
        if (requestActor != null && requestActor.displayName() != null && !requestActor.displayName().isBlank()) {
            return requestActor.displayName().trim();
        }
        if (requestActor != null && requestActor.username() != null && !requestActor.username().isBlank()) {
            return requestActor.username().trim();
        }
        return actor == null || actor.isBlank() ? "Archive user" : actor.trim();
    }

    public ActivityScope enrichScope(ActivityScope scope, RequestActor requestActor) {
        if (scope == null) {
            scope = ActivityScope.empty();
        }
        if (requestActor == null || (requestActor.accountId() == null && requestActor.username() == null)) {
            return scope;
        }
        return ActivityScope.builder()
                .sourceRole(scope.sourceRole())
                .targetRole(scope.targetRole())
                .academicDepartment(scope.academicDepartment())
                .documentCategory(scope.documentCategory())
                .studentNumber(scope.studentNumber())
                .actorAccountId(scope.actorAccountId() != null ? scope.actorAccountId() : requestActor.accountId())
                .actorUsername(scope.actorUsername() != null && !scope.actorUsername().isBlank()
                        ? scope.actorUsername()
                        : requestActor.username())
                .build();
    }

    private boolean matchesTopic(ActivityEntryEntity entry, String topic) {
        if (topic == null || topic.isBlank()) {
            return true;
        }

        try {
            StudentDocumentCategory category = StudentDocumentCategory.valueOf(topic.trim().toUpperCase(Locale.ROOT));
            if (entry.getDocumentCategory() != null) {
                return entry.getDocumentCategory() == category;
            }

            String haystack = String.join(" ",
                    safe(entry.getMessage()),
                    safe(entry.getActor()),
                    entry.getCategory() == null ? "" : entry.getCategory().name()
            ).toLowerCase(Locale.ROOT);

            return switch (category) {
                case REGISTRATION_FORM -> containsAny(haystack, "registration", "enroll", "registrar", "sreg", "transcript");
                case REINTEGRATION_FORM -> containsAny(haystack, "reintegration", "reinstate", "srin", "re-entry");
                case APPLICATION_DOCUMENTS -> containsAny(haystack, "application", "admission", "sapp", "thesis", "approval");
                case EXAMINATION_DOCUMENTS -> containsAny(haystack, "exam", "marks", "grading", "sexm", "paper", "semester");
                case FINAL_YEAR_PROJECT -> containsAny(haystack, "project", "thesis", "final year", "capstone", "sfyp");
            };
        } catch (IllegalArgumentException ex) {
            return safe(entry.getMessage()).toLowerCase(Locale.ROOT).contains(topic.trim().toLowerCase(Locale.ROOT));
        }
    }

    private ActivityResponse toResponse(ActivityEntryEntity entry) {
        return new ActivityResponse(
                entry.getId(),
                entry.getMessage(),
                entry.getActor(),
                entry.getCategory() == null ? "" : entry.getCategory().name(),
                entry.getCreatedAt(),
                entry.getSourceRole() == null ? null : entry.getSourceRole().name(),
                entry.getTargetRole() == null ? null : entry.getTargetRole().name(),
                entry.getAcademicDepartment(),
                entry.getDocumentCategory() == null ? null : entry.getDocumentCategory().name(),
                entry.getStudentNumber(),
                entry.getActorAccountId(),
                entry.getActorUsername()
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
            case LIBRARIAN -> "Librarian";
            case STUDENT -> "Student";
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
