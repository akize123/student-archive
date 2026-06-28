package com.auca.archive.controller;

import com.auca.archive.dto.DashboardResponse;
import com.auca.archive.service.DashboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    public DashboardResponse getDashboard(@RequestHeader(value = "X-User-Role", required = false) String role) {
        return dashboardService.getDashboard(role);
    }
}
