package com.auca.archive.controller;

import com.auca.archive.dto.AdminDashboardResponse;
import com.auca.archive.dto.CreateUserRequest;
import com.auca.archive.dto.UpdateUserRequest;
import com.auca.archive.dto.UserAccountResponse;
import com.auca.archive.service.AdminService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
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

    @PostMapping("/users")
    public UserAccountResponse createUser(
            @Valid @RequestBody CreateUserRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        return adminService.createUser(request, role);
    }

    @PutMapping("/users/{id}")
    public UserAccountResponse updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        return adminService.updateUser(id, request, role);
    }
}
