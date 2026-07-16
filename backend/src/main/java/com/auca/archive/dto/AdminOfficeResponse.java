package com.auca.archive.dto;

import java.util.List;

public record AdminOfficeResponse(
        String role,
        String label,
        String department,
        String summary,
        int userCount,
        long recentActivityCount,
        List<String> categories,
        List<AdminOfficeMemberResponse> members
) {
}
