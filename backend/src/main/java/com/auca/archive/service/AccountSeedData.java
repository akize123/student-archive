package com.auca.archive.service;

import com.auca.archive.domain.UserRole;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class AccountSeedData implements CommandLineRunner {
    private final AccountService accountService;

    public AccountSeedData(AccountService accountService) {
        this.accountService = accountService;
    }

    @Override
    public void run(String... args) {
        accountService.ensureAccount("admin", "System Administrator", "Admin@123", UserRole.ADMIN, UserRole.ADMIN.getDepartment());
        accountService.ensureAccount("registrar", "Registrar Office", "Registrar@123", UserRole.REGISTRAR, UserRole.REGISTRAR.getDepartment());
        accountService.ensureAccount("exam.officer", "Examination Officer", "Exam@123", UserRole.EXAMINATION_OFFICER, UserRole.EXAMINATION_OFFICER.getDepartment());
        accountService.ensureAccount("hod", "Head of Department", "Hod@123", UserRole.HOD, UserRole.HOD.getDepartment());
    }
}
