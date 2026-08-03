package com.auca.archive.service;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.ActivityScope;
import com.auca.archive.model.AccountEntity;
import com.auca.archive.repository.AccountRepository;
import com.auca.archive.repository.FolderShareRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

@Service
public class AccessRevocationService {
    private final AccountRepository accountRepository;
    private final FolderShareRepository folderShareRepository;
    private final ActivityService activityService;

    public AccessRevocationService(
            AccountRepository accountRepository,
            FolderShareRepository folderShareRepository,
            ActivityService activityService
    ) {
        this.accountRepository = accountRepository;
        this.folderShareRepository = folderShareRepository;
        this.activityService = activityService;
    }

    @Transactional
    public void revokeAccountAccess(AccountEntity account, String reason) {
        if (account == null || account.getId() == null) {
            return;
        }

        long nextVersion = account.getAccessVersion() + 1;
        account.setAccessVersion(nextVersion);
        accountRepository.save(account);

        int removedShares = 0;
        if (account.getFullName() != null && !account.getFullName().isBlank()) {
            removedShares += folderShareRepository.deleteBySharedByIgnoreCase(account.getFullName().trim());
        }
        if (account.getUsername() != null && !account.getUsername().isBlank()) {
            removedShares += folderShareRepository.deleteBySharedByIgnoreCase(account.getUsername().trim());
        }

        activityService.recordAction(
                "Revoked archive access for \"" + account.getFullName() + "\""
                        + (reason == null || reason.isBlank() ? "" : ": " + reason)
                        + (removedShares > 0 ? " Removed " + removedShares + " active share(s)." : ""),
                "System",
                ActivityCategory.SYNC,
                ActivityScope.builder()
                        .sourceRole(UserRole.ADMIN)
                        .targetRole(account.getRole())
                        .academicDepartment(account.getDepartment())
                        .build()
        );
    }
}
