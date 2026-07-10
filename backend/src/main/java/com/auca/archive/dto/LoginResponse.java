package com.auca.archive.dto;

import java.util.List;

public record LoginResponse(
        Long id,
        String username,
        String fullName,
        String role,
        String roleLabel,
        String department,
        String dashboardTitle,
        String dashboardKey,
        List<String> privileges,
        String studentNumber
) {
}
