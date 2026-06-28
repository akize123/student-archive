package com.auca.archive.dto;

import java.time.LocalDateTime;
import java.util.List;

public record UserAccountResponse(
        Long id,
        String username,
        String fullName,
        String role,
        String roleLabel,
        String department,
        boolean active,
        List<String> privileges,
        LocalDateTime createdAt,
        LocalDateTime lastLoginAt
) {
}
