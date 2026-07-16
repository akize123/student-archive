package com.auca.archive.service;

import com.auca.archive.domain.ApprovalStatus;
import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.ActivityResponse;
import com.auca.archive.dto.ApprovalTaskResponse;
import com.auca.archive.dto.DashboardResponse;
import com.auca.archive.dto.DocumentListItemResponse;
import com.auca.archive.model.DocumentEntity;
import com.auca.archive.repository.ApprovalTaskRepository;
import com.auca.archive.repository.DocumentRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
public class DashboardService {
    private static final long STORAGE_LIMIT_BYTES = 100L * 1024 * 1024 * 1024;

    private final DocumentRepository documentRepository;
    private final ApprovalTaskRepository approvalTaskRepository;
    private final FolderService folderService;
    private final DocumentService documentService;
    private final ActivityService activityService;
    private final ArchiveAccessService accessService;
    private final StudentStorageService studentStorageService;

    public DashboardService(
            DocumentRepository documentRepository,
            ApprovalTaskRepository approvalTaskRepository,
            FolderService folderService,
            DocumentService documentService,
            ActivityService activityService,
            ArchiveAccessService accessService,
            StudentStorageService studentStorageService
    ) {
        this.documentRepository = documentRepository;
        this.approvalTaskRepository = approvalTaskRepository;
        this.folderService = folderService;
        this.documentService = documentService;
        this.activityService = activityService;
        this.accessService = accessService;
        this.studentStorageService = studentStorageService;
    }

    public DashboardResponse getDashboard() {
        return getDashboard(null);
    }

    public DashboardResponse getDashboard(String rawRole) {
        return getDashboard(rawRole, null);
    }

    public DashboardResponse getDashboard(String rawRole, String rawStudentNumber) {
        return getDashboard(rawRole, rawStudentNumber, null);
    }

    public DashboardResponse getDashboard(String rawRole, String rawStudentNumber, String rawViewerDepartment) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = rawStudentNumber == null || rawStudentNumber.isBlank() ? null : rawStudentNumber.trim();
        String viewerDepartment = rawViewerDepartment == null || rawViewerDepartment.isBlank()
                ? null
                : rawViewerDepartment.trim();
        accessService.requireStudentAccount(role, studentNumber);
        List<DocumentEntity> visibleDocuments = documentRepository.findAll().stream()
                .filter(document -> folderService.isDocumentAccessible(document, role, studentNumber))
                .sorted((left, right) -> {
                    LocalDateTime leftTime = left.getModifiedAt();
                    LocalDateTime rightTime = right.getModifiedAt();
                    if (leftTime == null && rightTime == null) return 0;
                    if (leftTime == null) return 1;
                    if (rightTime == null) return -1;
                    return rightTime.compareTo(leftTime);
                })
                .toList();
        long recentUploads = visibleDocuments.stream()
                .filter(document -> document.getCreatedAt() != null && document.getCreatedAt().isAfter(LocalDateTime.now().minusDays(7)))
                .count();
        boolean includeApprovals = role != UserRole.REGISTRAR;
        long pendingApprovals = includeApprovals
                ? approvalTaskRepository.findAll().stream()
                        .filter(task -> task.getStatus() == ApprovalStatus.PENDING)
                        .filter(task -> task.getDocumentId() != null)
                        .filter(task -> documentRepository.findById(task.getDocumentId())
                                .map(document -> folderService.isDocumentAccessible(document, role, studentNumber))
                                .orElse(false))
                        .count()
                : 0L;
        long departmentFiles = visibleDocuments.size();
        long storageUsedBytes = visibleDocuments.stream()
                .mapToLong(document -> document.getSizeBytes() == null ? 0L : document.getSizeBytes())
                .sum();
        List<ActivityResponse> recentActivity = activityService.recent(rawRole, null, null, viewerDepartment, studentNumber);
        List<DocumentListItemResponse> recentFiles = documentService.search(null, null, rawRole, rawStudentNumber).stream()
                .limit(8)
                .toList();
        ActivityResponse latestActivity = recentActivity.isEmpty() ? null : recentActivity.get(0);
        DocumentListItemResponse latestDocument = recentFiles.isEmpty() ? null : recentFiles.get(0);
        String workspaceDepartment = role == null ? (latestDocument == null ? "" : latestDocument.department()) : role.getDepartment();

        long storageLimitBytes = role == UserRole.STUDENT
                ? studentStorageService.getStorageLimitBytes()
                : STORAGE_LIMIT_BYTES;

        return new DashboardResponse(
                latestActivity == null ? "" : latestActivity.actor(),
                role == null ? (latestActivity == null ? "" : humanize(latestActivity.category())) : role.getDisplayName(),
                workspaceDepartment,
                latestActivity == null ? "" : formatRelativeTime(latestActivity.createdAt()),
                (int) pendingApprovals,
                recentUploads,
                pendingApprovals,
                departmentFiles,
                storageUsedBytes,
                storageLimitBytes,
                folderService.getTree(rawRole, rawStudentNumber),
                recentFiles,
                includeApprovals
                        ? approvalTaskRepository.findByStatusOrderByRequestedAtAsc(ApprovalStatus.PENDING)
                                .stream()
                                .filter(task -> task.getDocumentId() != null)
                                .filter(task -> documentRepository.findById(task.getDocumentId())
                                        .map(document -> folderService.isDocumentAccessible(document, role, studentNumber))
                                        .orElse(false))
                                .map(task -> {
                                    DocumentEntity document = documentRepository.findById(task.getDocumentId()).orElse(null);
                                    return new ApprovalTaskResponse(
                                            task.getId(),
                                            task.getDocumentId(),
                                            task.getDocumentTitle(),
                                            task.getRequestedBy(),
                                            document == null ? null : document.getStudentNumber(),
                                            document == null ? null : document.getDescription(),
                                            document == null ? null : document.getGithubUrl(),
                                            document == null ? null : document.getExternalLinks(),
                                            document == null ? null : document.getFileName(),
                                            task.getRequestedAt(),
                                            task.getDueAt(),
                                            task.getNote(),
                                            task.getPriority(),
                                            task.getStatus().name()
                                    );
                                })
                                .toList()
                        : List.of(),
                recentActivity
        );
    }

    private String humanize(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String normalized = value.replace('_', ' ').toLowerCase(Locale.ROOT);
        return Character.toUpperCase(normalized.charAt(0)) + normalized.substring(1);
    }

    private String formatRelativeTime(LocalDateTime timestamp) {
        if (timestamp == null) {
            return "";
        }
        Duration duration = Duration.between(timestamp, LocalDateTime.now());
        if (duration.isNegative() || duration.isZero()) {
            return "just now";
        }

        long minutes = duration.toMinutes();
        if (minutes < 60) {
            return minutes == 1 ? "1 minute ago" : minutes + " minutes ago";
        }

        long hours = duration.toHours();
        if (hours < 24) {
            return hours == 1 ? "1 hour ago" : hours + " hours ago";
        }

        long days = duration.toDays();
        return days == 1 ? "1 day ago" : days + " days ago";
    }
}
