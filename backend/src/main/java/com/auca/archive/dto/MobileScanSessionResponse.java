package com.auca.archive.dto;

import java.time.LocalDateTime;
import java.util.List;

public record MobileScanSessionResponse(
        String token,
        LocalDateTime expiresAt,
        String status,
        boolean ready,
        int pageCount,
        List<MobileScanPageResponse> pages
) {
}
