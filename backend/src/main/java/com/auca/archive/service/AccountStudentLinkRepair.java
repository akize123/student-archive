package com.auca.archive.service;

import com.auca.archive.domain.UserRole;
import com.auca.archive.model.AccountEntity;
import com.auca.archive.repository.AccountRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(2)
public class AccountStudentLinkRepair implements CommandLineRunner {
    private final AccountRepository accountRepository;
    private final StudentAccountProvisioningService studentAccountProvisioningService;

    public AccountStudentLinkRepair(
            AccountRepository accountRepository,
            StudentAccountProvisioningService studentAccountProvisioningService
    ) {
        this.accountRepository = accountRepository;
        this.studentAccountProvisioningService = studentAccountProvisioningService;
    }

    @Override
    public void run(String... args) {
        for (AccountEntity account : accountRepository.findAll()) {
            if (account.getRole() != UserRole.STUDENT) {
                continue;
            }
            try {
                studentAccountProvisioningService.syncStudentAccount(account);
                accountRepository.save(account);
            } catch (RuntimeException ignored) {
                // Leave manual admin repair for accounts that still cannot be linked automatically.
            }
        }
    }
}
