package com.auca.archive.web;

import com.auca.archive.domain.UserRole;
import com.auca.archive.service.AccountService;
import com.auca.archive.service.ArchiveAccessService;

public final class SessionRequestContext {
    private SessionRequestContext() {
    }

    public static String resolveViewerDepartment(
            AccountService accountService,
            ArchiveAccessService accessService,
            String rawRole,
            String rawAccountId,
            String headerDepartment
    ) {
        UserRole role = rawRole == null || rawRole.isBlank()
                ? null
                : accessService.resolveRole(rawRole);
        if (role != UserRole.HOD) {
            return null;
        }
        Long accountId = AccountService.parseAccountIdHeader(rawAccountId);
        return accountService.resolveViewerDepartment(accountId, role, headerDepartment);
    }
}
