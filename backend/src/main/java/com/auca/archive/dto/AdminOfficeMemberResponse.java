package com.auca.archive.dto;

public record AdminOfficeMemberResponse(
        Long id,
        String username,
        String fullName,
        String department,
        boolean active,
        long recentActivityCount
) {
}
