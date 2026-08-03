package com.auca.archive.controller;

import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.dto.CreateDocumentTypeDefinitionRequest;
import com.auca.archive.dto.DocumentTypeDefinitionResponse;
import com.auca.archive.service.DocumentTypeDefinitionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/document-types")
public class DocumentTypeDefinitionController {
    private final DocumentTypeDefinitionService typeService;

    public DocumentTypeDefinitionController(DocumentTypeDefinitionService typeService) {
        this.typeService = typeService;
    }

    @GetMapping
    public List<DocumentTypeDefinitionResponse> list(
            @RequestParam(required = false) StudentDocumentCategory category,
            @RequestParam(required = false) Long categoryDefinitionId,
            @RequestParam(required = false) String office,
            @RequestParam(required = false) String faculty,
            @RequestParam(required = false) String department,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        return typeService.list(role, category, categoryDefinitionId, office, faculty, department);
    }

    @PostMapping
    public DocumentTypeDefinitionResponse create(
            @Valid @RequestBody CreateDocumentTypeDefinitionRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId
    ) {
        return typeService.create(request, role, accountId);
    }
}
