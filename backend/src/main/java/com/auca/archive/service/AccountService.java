package com.auca.archive.service;

import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.LoginRequest;
import com.auca.archive.dto.LoginResponse;
import com.auca.archive.model.AccountEntity;
import com.auca.archive.repository.AccountRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Locale;

@Service
public class AccountService {
    private final AccountRepository accountRepository;
    private final PasswordHasher passwordHasher;
    private final AdminService adminService;

    public AccountService(
            AccountRepository accountRepository,
            PasswordHasher passwordHasher,
            AdminService adminService
    ) {
        this.accountRepository = accountRepository;
        this.passwordHasher = passwordHasher;
        this.adminService = adminService;
    }

    @Transactional
    public AccountEntity ensureAccount(String username, String fullName, String rawPassword, UserRole role, String department) {
        return ensureAccount(username, fullName, rawPassword, role, department, null);
    }

    @Transactional
    public AccountEntity ensureAccount(
            String username,
            String fullName,
            String rawPassword,
            UserRole role,
            String department,
            String studentNumber
    ) {
        String normalizedUsername = normalizeUsername(username);
        AccountEntity account = accountRepository.findByUsername(normalizedUsername).orElseGet(AccountEntity::new);
        account.setUsername(normalizedUsername);
        account.setFullName(fullName.trim());
        account.setRole(role);
        account.setDepartment(department.trim());
        account.setActive(Boolean.TRUE);
        if (studentNumber != null && !studentNumber.isBlank()) {
            account.setStudentNumber(studentNumber.trim());
        }
        if (account.getCreatedAt() == null) {
            account.setCreatedAt(LocalDateTime.now());
        }
        if (account.getPasswordHash() == null || account.getPasswordHash().isBlank()) {
            account.setPasswordHash(passwordHasher.hash(rawPassword));
        }
        return accountRepository.save(account);
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        String username = normalizeUsername(request.username());
        AccountEntity account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password"));

        if (!Boolean.TRUE.equals(account.getActive()) || !passwordHasher.matches(request.password(), account.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }

        account.setLastLoginAt(LocalDateTime.now());
        accountRepository.save(account);

        return toLoginResponse(account);
    }

    private LoginResponse toLoginResponse(AccountEntity account) {
        UserRole role = account.getRole();
        return new LoginResponse(
                account.getId(),
                account.getUsername(),
                account.getFullName(),
                role.name(),
                role.getDisplayName(),
                account.getDepartment(),
                role.getDashboardTitle(),
                role.getDashboardKey(),
                adminService.resolvePrivilegeCodes(account),
                account.getStudentNumber()
        );
    }

    private String normalizeUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username is required");
        }
        return username.trim().toLowerCase(Locale.ROOT);
    }
}
