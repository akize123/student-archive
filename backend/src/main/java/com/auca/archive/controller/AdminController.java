package com.auca.archive.controller;

import com.auca.archive.dto.AdminActivityPageResponse;
import com.auca.archive.dto.AdminDashboardResponse;
import com.auca.archive.dto.AdminOfficeResponse;
import com.auca.archive.dto.ArchiveTemplateNodeResponse;
import com.auca.archive.dto.CreateUserRequest;
import com.auca.archive.dto.RequestActor;
import com.auca.archive.dto.UpdateUserRequest;
import com.auca.archive.dto.UserAccountResponse;
import com.auca.archive.service.ActivityService;
import com.auca.archive.service.AdminService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AdminService adminService;
    private final ActivityService activityService;

    public AdminController(AdminService adminService, ActivityService activityService) {
        this.adminService = adminService;
        this.activityService = activityService;
    }

    @GetMapping("/dashboard")
    public AdminDashboardResponse dashboard(@RequestHeader(value = "X-User-Role", required = false) String role) {
        return adminService.getDashboard(role);
    }

    @GetMapping("/users")
    public List<UserAccountResponse> listUsers(@RequestHeader(value = "X-User-Role", required = false) String role) {
        return adminService.listUsers(role);
    }

    @GetMapping("/privileges")
    public List<Map<String, String>> listPrivileges(@RequestHeader(value = "X-User-Role", required = false) String role) {
        return adminService.listPrivileges(role);
    }

    @GetMapping("/activity")
    public AdminActivityPageResponse activity(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestParam(required = false) String scope,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        return adminService.listActivity(role, scope, userId, category, page, size);
    }

    @GetMapping("/activity/recent")
    public List<com.auca.archive.dto.ActivityResponse> recentActivity(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestParam(defaultValue = "5") int limit
    ) {
        adminService.requireAdmin(role);
        return activityService.adminRecent(limit);
    }

    @GetMapping("/offices")
    public List<AdminOfficeResponse> offices(@RequestHeader(value = "X-User-Role", required = false) String role) {
        return adminService.listOffices(role);
    }

    @GetMapping("/archive-template")
    public List<ArchiveTemplateNodeResponse> archiveTemplate(
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        return adminService.archiveTemplate(role);
    }

    @PostMapping("/users")
    public UserAccountResponse createUser(
            @Valid @RequestBody CreateUserRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId,
            @RequestHeader(value = "X-User-Username", required = false) String username,
            @RequestHeader(value = "X-User-Name", required = false) String actorName
    ) {
        return adminService.createUser(request, role, RequestActor.fromHeaders(accountId, username, actorName));
    }

    @PutMapping("/users/{id}")
    public UserAccountResponse updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId,
            @RequestHeader(value = "X-User-Username", required = false) String username,
            @RequestHeader(value = "X-User-Name", required = false) String actorName
    ) {
        return adminService.updateUser(id, request, role, RequestActor.fromHeaders(accountId, username, actorName));
    }
}
