package com.auca.archive.controller;

import com.auca.archive.dto.ShareFolderResponse;
import com.auca.archive.dto.ShareItemsRequest;
import com.auca.archive.dto.SharedItemResponse;
import com.auca.archive.service.FolderService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/shares")
public class ShareController {
    private final FolderService folderService;

    public ShareController(FolderService folderService) {
        this.folderService = folderService;
    }

    @PostMapping
    public ShareFolderResponse shareItems(
            @Valid @RequestBody ShareItemsRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-User-Name", required = false) String actorName,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId,
            @RequestHeader(value = "X-User-Username", required = false) String username
    ) {
        return folderService.shareItems(
                request.folderIds(),
                request.documentIds(),
                request.targetRole(),
                request.permission(),
                request.expirationPreset(),
                request.expiresAt(),
                request.allowReshare(),
                role,
                actorName,
                com.auca.archive.dto.RequestActor.fromHeaders(accountId, username, actorName)
        );
    }

    @GetMapping("/with-me")
    public List<SharedItemResponse> sharedWithMe(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber
    ) {
        return folderService.listSharedWithMe(role, studentNumber);
    }

    @GetMapping("/with-me/count")
    public Map<String, Object> sharedWithMeCount(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber
    ) {
        return Map.of("count", folderService.countSharedWithMe(role, studentNumber));
    }
}
