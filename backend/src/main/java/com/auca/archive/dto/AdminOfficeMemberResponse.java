package com.auca.archive.dto;

public record AdminOfficeMemberResponse(
        Long id,
        String username,
        String fullName,
        boolean active,
        long recentActivityCount
) {
}
