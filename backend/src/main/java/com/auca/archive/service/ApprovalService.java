package com.auca.archive.service;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.ApprovalStatus;
import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.dto.ApprovalDecisionRequest;
import com.auca.archive.dto.ApprovalTaskResponse;
import com.auca.archive.dto.DocumentDetailResponse;
import com.auca.archive.model.ApprovalTaskEntity;
import com.auca.archive.repository.ApprovalTaskRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ApprovalService {
    private final ApprovalTaskRepository approvalTaskRepository;
    private final DocumentService documentService;
    private final ActivityService activityService;

    public ApprovalService(
            ApprovalTaskRepository approvalTaskRepository,
            DocumentService documentService,
            ActivityService activityService
    ) {
        this.approvalTaskRepository = approvalTaskRepository;
        this.documentService = documentService;
        this.activityService = activityService;
    }

    public List<ApprovalTaskResponse> pending() {
        return approvalTaskRepository.findByStatusOrderByRequestedAtAsc(ApprovalStatus.PENDING)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ApprovalTaskResponse decide(Long id, ApprovalDecisionRequest request) {
        ApprovalTaskEntity task = approvalTaskRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Approval not found: " + id));
        String decision = request.decision().trim().toLowerCase();
        String note = request.note() == null ? "" : request.note().trim();
        if ("approve".equals(decision)) {
            task.setStatus(ApprovalStatus.APPROVED);
            task.setNote(note.isBlank() ? "Approved by librarian" : note);
            documentService.updateStatus(task.getDocumentId(), DocumentStatus.APPROVED, task.getNote(), null);
            activityService.recordAction(
                    "Librarian approved final year project \"" + task.getDocumentTitle() + "\"",
                    "Librarian",
                    ActivityCategory.APPROVAL
            );
        } else if ("reject".equals(decision)) {
            if (note.isBlank()) {
                throw new IllegalArgumentException("Please provide feedback when rejecting a project");
            }
            task.setStatus(ApprovalStatus.REJECTED);
            task.setNote(note);
            documentService.updateStatus(task.getDocumentId(), DocumentStatus.REJECTED, note, null);
            activityService.recordAction(
                    "Librarian rejected final year project \"" + task.getDocumentTitle() + "\"",
                    "Librarian",
                    ActivityCategory.APPROVAL
            );
        } else {
            throw new IllegalArgumentException("Decision must be approve or reject");
        }
        return toResponse(approvalTaskRepository.save(task));
    }

    private ApprovalTaskResponse toResponse(ApprovalTaskEntity task) {
        DocumentDetailResponse document = null;
        try {
            if (task.getDocumentId() != null) {
                document = documentService.getDocument(task.getDocumentId(), "LIBRARIAN");
            }
        } catch (RuntimeException ignored) {
            // Keep the approval card usable even if the document was removed.
        }
        return new ApprovalTaskResponse(
                task.getId(),
                task.getDocumentId(),
                task.getDocumentTitle(),
                task.getRequestedBy(),
                document == null ? null : document.studentNumber(),
                document == null ? null : document.description(),
                document == null ? null : document.githubUrl(),
                document == null ? null : document.externalLinks(),
                document == null ? null : document.fileName(),
                task.getRequestedAt(),
                task.getDueAt(),
                task.getNote(),
                task.getPriority(),
                task.getStatus().name()
        );
    }
}
