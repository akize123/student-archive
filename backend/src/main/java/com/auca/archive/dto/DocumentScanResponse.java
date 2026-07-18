package com.auca.archive.dto;

import java.util.List;

public record DocumentScanResponse(
        boolean verified,
        String summary,
        List<String> matchedSignals,
        int pageCount,
        String scanMethod,
        String preview,
        boolean malwareScanPassed,
        String malwareScanSummary
) {
}
