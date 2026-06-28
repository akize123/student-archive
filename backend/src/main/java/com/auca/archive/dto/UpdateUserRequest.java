package com.auca.archive.dto;

import com.auca.archive.domain.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateUserRequest(
        @NotBlank(message = "Full name is required")
        String fullName,

        @NotNull(message = "Role is required")
        UserRole role,

        @NotBlank(message = "Department is required")
        String department,

        Boolean active,

        List<String> privileges,

        @Size(min = 6, message = "Password must be at least 6 characters")
        String password
) {
}
