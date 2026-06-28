package com.auca.archive.service;

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

    public ApprovalService(ApprovalTaskRepository approvalTaskRepository, DocumentService documentService) {
        this.approvalTaskRepository = approvalTaskRepository;
        this.documentService = documentService;
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
        if ("approve".equals(decision)) {
            task.setStatus(ApprovalStatus.APPROVED);
            documentService.updateStatus(task.getDocumentId(), DocumentStatus.APPROVED);
        } else if ("reject".equals(decision)) {
            task.setStatus(ApprovalStatus.REJECTED);
            documentService.updateStatus(task.getDocumentId(), DocumentStatus.REJECTED);
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
