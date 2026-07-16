package com.auca.archive.controller;

import com.auca.archive.dto.AddAcademicYearRequest;
import com.auca.archive.dto.CreateFolderRequest;
import com.auca.archive.dto.FolderDetailResponse;
import com.auca.archive.dto.FolderImportResponse;
import com.auca.archive.dto.FolderNodeResponse;
import com.auca.archive.dto.FolderTargetRequest;
import com.auca.archive.dto.RenameFolderRequest;
import com.auca.archive.dto.ShareFolderRequest;
import com.auca.archive.dto.ShareFolderResponse;
import com.auca.archive.service.FolderImportService;
import com.auca.archive.service.FolderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/folders")
public class FolderController {
    private final FolderService folderService;
    private final FolderImportService folderImportService;

    public FolderController(FolderService folderService, FolderImportService folderImportService) {
        this.folderService = folderService;
        this.folderImportService = folderImportService;
    }

    @GetMapping("/published-archive/tree")
    public FolderNodeResponse publishedArchiveTree(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber
    ) {
        return folderService.getStudentPublishedArchiveTree(studentNumber)
                .orElseThrow(() -> new IllegalArgumentException("Published archive is unavailable for this student"));
    }

    @GetMapping("/tree")
    public List<FolderNodeResponse> tree(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber
    ) {
        return folderService.getTree(role, studentNumber);
    }

    @GetMapping("/{id}")
    public FolderDetailResponse getFolder(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber
    ) {
        return folderService.getFolderDetail(id, role, studentNumber);
    }

    @PostMapping("/{parentId}/subfolders")
    public FolderNodeResponse createSubfolder(
            @PathVariable Long parentId,
            @Valid @RequestBody CreateFolderRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber
    ) {
        return folderService.createSubfolder(parentId, request.name(), role, studentNumber);
    }

    @PostMapping("/{departmentId}/academic-years")
    public FolderNodeResponse addAcademicYear(
            @PathVariable Long departmentId,
            @Valid @RequestBody AddAcademicYearRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId,
            @RequestHeader(value = "X-User-Username", required = false) String username,
            @RequestHeader(value = "X-User-Name", required = false) String actorName
    ) {
        return folderService.addAcademicYear(
                departmentId,
                request.academicYear(),
                role,
                com.auca.archive.dto.RequestActor.fromHeaders(accountId, username, actorName)
        );
    }

    @PatchMapping("/{id}")
    public FolderNodeResponse renameFolder(
            @PathVariable Long id,
            @Valid @RequestBody RenameFolderRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber
    ) {
        return folderService.renameFolder(id, request.name(), role, studentNumber);
    }

    @PostMapping("/{id}/move")
    public FolderNodeResponse moveFolder(
            @PathVariable Long id,
            @Valid @RequestBody FolderTargetRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber
    ) {
        return folderService.moveFolder(id, request.targetParentId(), role, studentNumber);
    }

    @PostMapping("/{id}/copy")
    public FolderNodeResponse copyFolder(
            @PathVariable Long id,
            @Valid @RequestBody FolderTargetRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber
    ) throws IOException {
        return folderService.copyFolder(id, request.targetParentId(), role, studentNumber);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> deleteFolder(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        folderService.deleteFolder(id, role);
        Map<String, String> response = new LinkedHashMap<>();
        response.put("message", "Folder deleted");
        return response;
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> downloadFolder(
            @PathVariable Long id,
            @RequestParam(required = false) List<Long> documentIds,
            @RequestParam(required = false) List<Long> folderIds,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber
    ) throws IOException {
        byte[] zipBytes = folderService.downloadAsZip(id, documentIds, folderIds, role, studentNumber);
        FolderDetailResponse folder = folderService.getFolderDetail(id, role, studentNumber);
        String safeName = folder.name().replaceAll("[^a-zA-Z0-9-_ ]", "_").trim().replaceAll("\\s+", "-");
        if (safeName.isBlank()) {
            safeName = "folder-" + id;
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeName + ".zip\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(zipBytes);
    }

    @PostMapping("/{id}/share")
    public ShareFolderResponse shareFolder(
            @PathVariable Long id,
            @Valid @RequestBody ShareFolderRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-User-Name", required = false) String actorName,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId,
            @RequestHeader(value = "X-User-Username", required = false) String username
    ) {
        return folderService.shareFolder(
                id,
                request.targetRole(),
                request.permission(),
                role,
                actorName,
                com.auca.archive.dto.RequestActor.fromHeaders(accountId, username, actorName)
        );
    }

    @GetMapping("/{id}/has-contents")
    public Map<String, Object> folderHasContents(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("hasContents", folderService.folderHasContents(id, role));
        return response;
    }

    @PostMapping(value = "/{id}/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public FolderImportResponse importIntoFolder(
            @PathVariable Long id,
            @RequestPart(value = "archive", required = false) MultipartFile archive,
            @RequestPart(value = "files", required = false) List<MultipartFile> files,
            @RequestParam(value = "paths", required = false) List<String> paths,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-User-Name", required = false) String actorName,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId,
            @RequestHeader(value = "X-User-Username", required = false) String username
    ) throws IOException {
        return folderImportService.importIntoFolder(
                id,
                archive,
                files,
                paths,
                role,
                actorName,
                com.auca.archive.dto.RequestActor.fromHeaders(accountId, username, actorName)
        );
    }
}
