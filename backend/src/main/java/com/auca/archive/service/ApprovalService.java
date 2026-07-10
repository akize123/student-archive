package com.auca.archive.service;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.ApprovalStatus;
import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.dto.ApprovalDecisionRequest;
import com.auca.archive.dto.ApprovalTaskResponse;
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
        return approvalTaskRepository.findTop5ByStatusOrderByRequestedAtAsc(ApprovalStatus.PENDING)
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
        return new ApprovalTaskResponse(
                task.getId(),
                task.getDocumentId(),
                task.getDocumentTitle(),
                task.getRequestedBy(),
                task.getRequestedAt(),
                task.getDueAt(),
                task.getNote(),
                task.getPriority(),
                task.getStatus().name()
        );
    }
}
