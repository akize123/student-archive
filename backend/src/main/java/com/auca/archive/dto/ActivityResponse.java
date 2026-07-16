package com.auca.archive.dto;

import java.time.LocalDateTime;

public record ActivityResponse(
        Long id,
        String message,
        String actor,
        String category,
        LocalDateTime createdAt,
        String sourceRole,
        String targetRole,
        String academicDepartment,
        String documentCategory,
        String studentNumber,
        Long actorAccountId,
        String actorUsername
) {
}
