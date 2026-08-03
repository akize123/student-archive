package com.auca.archive.dto;

import java.util.List;
import java.util.Map;

public record AdminDashboardResponse(
        int totalUsers,
        int activeUsers,
        int inactiveUsers,
        Map<String, Long> usersByRole,
        List<UserAccountResponse> users
) {
}
