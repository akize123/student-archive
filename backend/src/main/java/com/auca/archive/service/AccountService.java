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
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class AccountService {
    private final AccountRepository accountRepository;
    private final PasswordHasher passwordHasher;
    private final AdminService adminService;
    private final StudentAccountProvisioningService studentAccountProvisioningService;

    public AccountService(
            AccountRepository accountRepository,
            PasswordHasher passwordHasher,
            AdminService adminService,
            StudentAccountProvisioningService studentAccountProvisioningService
    ) {
        this.accountRepository = accountRepository;
        this.passwordHasher = passwordHasher;
        this.adminService = adminService;
        this.studentAccountProvisioningService = studentAccountProvisioningService;
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

    /**
     * Demo HOD seed: always refresh password so keyword logins stay predictable across restarts.
     */
    @Transactional
    public AccountEntity ensureDemoHodAccount(String username, String fullName, String rawPassword, String department) {
        AccountEntity account = ensureAccount(username, fullName, rawPassword, UserRole.HOD, department);
        account.setPasswordHash(passwordHasher.hash(rawPassword));
        return accountRepository.save(account);
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        String username = normalizeUsername(request.username());
        AccountEntity account = resolveLoginAccount(username, request.password());

        account.setLastLoginAt(LocalDateTime.now());
        if (account.getRole() == UserRole.STUDENT) {
            studentAccountProvisioningService.syncStudentAccount(account);
        }
        accountRepository.save(account);

        return toLoginResponse(account);
    }

    private AccountEntity resolveLoginAccount(String username, String rawPassword) {
        if (rawPassword == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }
        String password = rawPassword.trim();
        if (password.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }

        AccountEntity account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password"));

        if (!Boolean.TRUE.equals(account.getActive()) || !passwordHasher.matches(password, account.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }
        return account;
    }

    @Transactional
    public void deactivateLegacyDemoHodAccounts(List<String> usernames) {
        if (usernames == null || usernames.isEmpty()) {
            return;
        }
        for (String username : usernames) {
            if (username == null || username.isBlank()) {
                continue;
            }
            accountRepository.findByUsername(normalizeUsername(username)).ifPresent(account -> {
                if (account.getRole() == UserRole.HOD && Boolean.TRUE.equals(account.getActive())) {
                    account.setActive(Boolean.FALSE);
                    accountRepository.save(account);
                }
            });
        }
    }

    @Transactional
    public void resetAccountPassword(String username, String rawPassword) {
        String normalizedUsername = normalizeUsername(username);
        AccountEntity account = accountRepository.findByUsername(normalizedUsername)
                .orElseThrow(() -> new IllegalArgumentException("Account not found: " + username));
        account.setPasswordHash(passwordHasher.hash(rawPassword));
        accountRepository.save(account);
    }

    public LoginResponse getSessionProfile(Long accountId) {
        if (accountId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in again.");
        }
        AccountEntity account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in again."));
        if (!Boolean.TRUE.equals(account.getActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This account is inactive.");
        }
        if (account.getRole() == UserRole.STUDENT) {
            studentAccountProvisioningService.syncStudentAccount(account);
            accountRepository.save(account);
        }
        return toLoginResponse(account);
    }

    public Optional<String> resolveLinkedStudentNumber(Long accountId) {
        if (accountId == null) {
            return Optional.empty();
        }
        return accountRepository.findById(accountId)
                .filter(account -> account.getRole() == UserRole.STUDENT)
                .map(AccountEntity::getStudentNumber)
                .filter(value -> value != null && !value.isBlank())
                .map(value -> value.trim().toUpperCase(Locale.ROOT));
    }

    public String resolveViewerDepartment(Long accountId, UserRole role, String headerDepartment) {
        if (role != UserRole.HOD) {
            return null;
        }
        if (accountId != null) {
            Optional<String> fromAccount = accountRepository.findById(accountId)
                    .filter(account -> account.getRole() == UserRole.HOD)
                    .map(AccountEntity::getDepartment)
                    .filter(value -> value != null && !value.isBlank())
                    .map(String::trim);
            if (fromAccount.isPresent()) {
                return fromAccount.get();
            }
        }
        if (headerDepartment == null || headerDepartment.isBlank()) {
            return null;
        }
        return headerDepartment.trim();
    }

    public static Long parseAccountIdHeader(String rawAccountId) {
        if (rawAccountId == null || rawAccountId.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(rawAccountId.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
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
                account.getStudentNumber(),
                account.getAccessVersion()
        );
    }

    private String normalizeUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username is required");
        }
        return username.trim().toLowerCase(Locale.ROOT);
    }
}
