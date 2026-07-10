package com.auca.archive.controller;

import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.dto.DocumentDetailResponse;
import com.auca.archive.dto.DocumentListItemResponse;
import com.auca.archive.dto.DocumentScanContext;
import com.auca.archive.dto.DocumentScanResponse;
import com.auca.archive.dto.UpdateDocumentStatusRequest;
import com.auca.archive.dto.UploadDocumentRequest;
import com.auca.archive.service.DocumentScanService;
import com.auca.archive.service.DocumentService;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {
    private final DocumentService documentService;
    private final DocumentScanService documentScanService;

    public DocumentController(DocumentService documentService, DocumentScanService documentScanService) {
        this.documentService = documentService;
        this.documentScanService = documentScanService;
    }

    @GetMapping
    public List<DocumentListItemResponse> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) StudentDocumentCategory category,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber
    ) {
        return documentService.search(q, category, role, studentNumber);
    }

    @GetMapping("/archived")
    public List<DocumentListItemResponse> listArchived(
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        return documentService.listArchived(role);
    }

    @PostMapping("/{id}/restore")
    public Map<String, String> restoreDocument(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        documentService.restoreDocument(id, role);
        Map<String, String> response = new java.util.LinkedHashMap<>();
        response.put("message", "Document restored from archive");
        return response;
    }

    @DeleteMapping("/{id}/permanent")
    public Map<String, String> permanentlyDeleteDocument(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        documentService.permanentlyDeleteDocument(id, role);
        Map<String, String> response = new java.util.LinkedHashMap<>();
        response.put("message", "Document permanently deleted");
        return response;
    }

    @GetMapping("/{id}")
    public DocumentDetailResponse getDocument(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber
    ) {
        return documentService.getDocument(id, role, studentNumber);
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> download(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber
    ) throws IOException {
        Resource resource = documentService.download(id, role, studentNumber);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + resource.getFilename() + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }

    @PostMapping(value = "/scan", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentScanResponse scan(
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "context", required = false) DocumentScanContext context
    ) throws IOException {
        return documentScanService.scan(file, context);
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentDetailResponse upload(
            @Valid @RequestPart("metadata") UploadDocumentRequest metadata,
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "coverPhoto", required = false) MultipartFile coverPhoto,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber
    ) throws IOException {
        return documentService.upload(metadata, file, coverPhoto, role, studentNumber);
    }

    @PatchMapping("/{id}/status")
    public DocumentDetailResponse updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateDocumentStatusRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        return documentService.updateStatus(id, DocumentStatus.valueOf(request.status().toUpperCase()), role);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> deleteDocument(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        documentService.archiveDocument(id, role);
        Map<String, String> response = new java.util.LinkedHashMap<>();
        response.put("message", "Document moved to archive");
        return response;
    }
}
