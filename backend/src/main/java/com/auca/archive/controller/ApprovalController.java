package com.auca.archive.controller;

import com.auca.archive.dto.ApprovalDecisionRequest;
import com.auca.archive.dto.ApprovalTaskResponse;
import com.auca.archive.service.ApprovalService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/approvals")
public class ApprovalController {
    private final ApprovalService approvalService;

    public ApprovalController(ApprovalService approvalService) {
        this.approvalService = approvalService;
    }

    @GetMapping("/pending")
    public List<ApprovalTaskResponse> pending() {
        return approvalService.pending();
    }

    @PostMapping("/{id}/decision")
    public ApprovalTaskResponse decide(@PathVariable Long id, @Valid @RequestBody ApprovalDecisionRequest request) {
        return approvalService.decide(id, request);
    }
}

