package com.auca.archive.dto;

import java.util.List;

public record DocumentScanResponse(
        boolean verified,
        String summary,
        List<String> matchedSignals,
        int pageCount,
        String scanMethod,
        String preview,
        Integer similarityScore,
        String templateTitle,
        Long templateId,
        List<String> failedRules
) {
    public DocumentScanResponse(
            boolean verified,
            String summary,
            List<String> matchedSignals,
            int pageCount,
            String scanMethod,
            String preview
    ) {
        this(verified, summary, matchedSignals, pageCount, scanMethod, preview, null, null, null, null);
    }
}
