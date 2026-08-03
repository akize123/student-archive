package com.auca.archive.controller;

import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.dto.DocumentTemplateResponse;
import com.auca.archive.dto.UpdateDocumentTemplateRequest;
import com.auca.archive.service.DocumentTemplateService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/document-templates")
public class DocumentTemplateController {
    private final DocumentTemplateService templateService;

    public DocumentTemplateController(DocumentTemplateService templateService) {
        this.templateService = templateService;
    }

    @GetMapping
    public List<DocumentTemplateResponse> list(
            @RequestParam(required = false) StudentDocumentCategory category,
            @RequestParam(required = false) String office,
            @RequestParam(required = false) String faculty,
            @RequestParam(required = false) String department,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        return templateService.list(role, category, office, faculty, department);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentTemplateResponse upload(
            @RequestPart("file") MultipartFile file,
            @RequestParam StudentDocumentCategory category,
            @RequestParam String documentTypeName,
            @RequestParam String office,
            @RequestParam(required = false) String faculty,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) Integer similarityThreshold,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId
    ) throws IOException {
        return templateService.upload(
                file,
                category,
                documentTypeName,
                office,
                faculty,
                department,
                title,
                similarityThreshold,
                role,
                accountId
        );
    }

    @PatchMapping("/{id}")
    public DocumentTemplateResponse update(
            @PathVariable Long id,
            @RequestBody UpdateDocumentTemplateRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        return templateService.update(id, request, role);
    }

    @GetMapping("/{id}/preview-text")
    public Map<String, String> previewText(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        return Map.of("preview", templateService.previewText(id, role));
    }
}
