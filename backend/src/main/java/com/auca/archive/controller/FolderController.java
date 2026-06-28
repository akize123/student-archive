package com.auca.archive.controller;

import com.auca.archive.dto.CreateFolderRequest;
import com.auca.archive.dto.FolderDetailResponse;
import com.auca.archive.dto.FolderNodeResponse;
import com.auca.archive.service.FolderService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/folders")
public class FolderController {
    private final FolderService folderService;

    public FolderController(FolderService folderService) {
        this.folderService = folderService;
    }

    @GetMapping("/tree")
    public List<FolderNodeResponse> tree(@RequestHeader(value = "X-User-Role", required = false) String role) {
        return folderService.getTree(role);
    }

    @GetMapping("/{id}")
    public FolderDetailResponse getFolder(@PathVariable Long id, @RequestHeader(value = "X-User-Role", required = false) String role) {
        return folderService.getFolderDetail(id, role);
    }

    @PostMapping("/{parentId}/subfolders")
    public FolderNodeResponse createSubfolder(
            @PathVariable Long parentId,
            @Valid @RequestBody CreateFolderRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        return folderService.createSubfolder(parentId, request.name(), role);
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
}
