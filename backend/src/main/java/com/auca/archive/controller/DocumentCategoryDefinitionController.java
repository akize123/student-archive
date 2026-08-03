package com.auca.archive.controller;

import com.auca.archive.dto.CreateDocumentCategoryDefinitionRequest;
import com.auca.archive.dto.DocumentCategoryDefinitionResponse;
import com.auca.archive.service.DocumentCategoryDefinitionService;
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
@RequestMapping("/api/document-categories")
public class DocumentCategoryDefinitionController {
    private final DocumentCategoryDefinitionService categoryService;

    public DocumentCategoryDefinitionController(DocumentCategoryDefinitionService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public List<DocumentCategoryDefinitionResponse> list(
            @RequestParam(required = false) String office,
            @RequestParam(required = false) String faculty,
            @RequestParam(required = false) String department,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        return categoryService.list(role, office, faculty, department);
    }

    @PostMapping
    public DocumentCategoryDefinitionResponse create(
            @Valid @RequestBody CreateDocumentCategoryDefinitionRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId
    ) {
        return categoryService.create(request, role, accountId);
    }
}
