package com.auca.archive.dto;

import java.util.List;

public record DashboardResponse(
        String userName,
        String role,
        String department,
        String lastSignIn,
        int notifications,
        long recentlyUploaded,
        long pendingApprovals,
        long departmentFiles,
        long storageUsedBytes,
        long storageLimitBytes,
        List<FolderNodeResponse> archiveTree,
        List<DocumentListItemResponse> recentFiles,
        List<ApprovalTaskResponse> awaitingApproval,
        List<ActivityResponse> departmentActivity
) {
}

