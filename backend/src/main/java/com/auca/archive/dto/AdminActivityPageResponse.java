package com.auca.archive.dto;

import java.util.List;

public record AdminActivityPageResponse(
        List<ActivityResponse> items,
        long total,
        int page,
        int size
) {
}
