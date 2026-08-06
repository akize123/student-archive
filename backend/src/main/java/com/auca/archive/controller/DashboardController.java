package com.auca.archive.controller;

import com.auca.archive.dto.DashboardResponse;
import com.auca.archive.service.AccountService;
import com.auca.archive.service.ArchiveAccessService;
import com.auca.archive.service.DashboardService;
import com.auca.archive.web.SessionRequestContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final DashboardService dashboardService;
    private final AccountService accountService;
    private final ArchiveAccessService accessService;

    public DashboardController(
            DashboardService dashboardService,
            AccountService accountService,
            ArchiveAccessService accessService
    ) {
        this.dashboardService = dashboardService;
        this.accountService = accountService;
        this.accessService = accessService;
    }

    @GetMapping
    public DashboardResponse getDashboard(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String studentNumber,
            @RequestHeader(value = "X-User-Department", required = false) String department,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId
    ) {
        String viewerDepartment = SessionRequestContext.resolveViewerDepartment(
                accountService,
                accessService,
                role,
                accountId,
                department
        );
        return dashboardService.getDashboard(role, studentNumber, viewerDepartment, accountId);
    }
}
