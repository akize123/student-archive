package com.auca.archive.controller;

import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.dto.CreateDocumentSubtypeRequest;
import com.auca.archive.dto.DocumentSubtypeResponse;
import com.auca.archive.dto.UpdateDocumentSubtypeRequest;
import com.auca.archive.service.DocumentSubtypeService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/document-subtypes")
public class DocumentSubtypeController {
    private final DocumentSubtypeService subtypeService;

    public DocumentSubtypeController(DocumentSubtypeService subtypeService) {
        this.subtypeService = subtypeService;
    }

    @GetMapping
    public List<DocumentSubtypeResponse> list(
            @RequestParam(required = false) StudentDocumentCategory category,
            @RequestParam(required = false) String department,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        return subtypeService.list(role, category, department);
    }

    @PostMapping
    public DocumentSubtypeResponse create(
            @Valid @RequestBody CreateDocumentSubtypeRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-User-Name", required = false) String actorName
    ) {
        return subtypeService.create(request, role, actorName);
    }

    @PatchMapping("/{id}")
    public DocumentSubtypeResponse update(
            @PathVariable Long id,
            @RequestBody UpdateDocumentSubtypeRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        return subtypeService.update(id, request, role);
    }
}
