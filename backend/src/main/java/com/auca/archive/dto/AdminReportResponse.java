package com.auca.archive.dto;

import java.util.List;
import java.util.Map;

public record AdminReportResponse(
        String generatedAt,
        int totalUsers,
        int activeUsers,
        int inactiveUsers,
        Map<String, Long> usersByRole,
        int totalDocuments,
        int activeDocuments,
        int archivedDocuments,
        Map<String, Long> documentsByCategory,
        Map<String, Long> documentsByStatus,
        long uploadsLast7Days,
        long totalActivities,
        Map<String, Long> activitiesByCategory,
        Map<String, Long> activitiesByOffice,
        long totalShares,
        List<TrendPoint> uploadTrend
) {
    public record TrendPoint(String date, long count) {
    }
}
