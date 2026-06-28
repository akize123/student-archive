package com.auca.archive.dto;

public record LoginResponse(
        Long id,
        String username,
        String fullName,
        String role,
        String roleLabel,
        String department,
        String dashboardTitle,
        String dashboardKey
) {
}
