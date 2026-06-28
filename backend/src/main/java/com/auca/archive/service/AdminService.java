package com.auca.archive.service;

import com.auca.archive.domain.SystemPrivilege;
import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.AdminDashboardResponse;
import com.auca.archive.dto.CreateUserRequest;
import com.auca.archive.dto.UpdateUserRequest;
import com.auca.archive.dto.UserAccountResponse;
import com.auca.archive.model.AccountEntity;
import com.auca.archive.repository.AccountRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AdminService {
    private final AccountRepository accountRepository;
    private final PasswordHasher passwordHasher;
    private final ArchiveAccessService accessService;

    public AdminService(
            AccountRepository accountRepository,
            PasswordHasher passwordHasher,
            ArchiveAccessService accessService
    ) {
        this.accountRepository = accountRepository;
        this.passwordHasher = passwordHasher;
        this.accessService = accessService;
    }

    public AdminDashboardResponse getDashboard(String rawRole) {
        requireAdmin(rawRole);
        List<UserAccountResponse> users = listUsers(rawRole);
        int activeUsers = (int) users.stream().filter(UserAccountResponse::active).count();
        Map<String, Long> usersByRole = users.stream()
                .collect(Collectors.groupingBy(UserAccountResponse::role, LinkedHashMap::new, Collectors.counting()));

        return new AdminDashboardResponse(
                users.size(),
                activeUsers,
                users.size() - activeUsers,
                usersByRole,
                users
        );
    }

    public List<UserAccountResponse> listUsers(String rawRole) {
        requireAdmin(rawRole);
        return accountRepository.findAll().stream()
                .sorted(Comparator.comparing(AccountEntity::getFullName, String.CASE_INSENSITIVE_ORDER))
                .map(this::toUserResponse)
                .toList();
    }

    public UserAccountResponse createUser(CreateUserRequest request, String rawRole) {
        requireAdmin(rawRole);
        String username = normalizeUsername(request.username());
        if (accountRepository.findByUsername(username).isPresent()) {
            throw new IllegalArgumentException("Username already exists");
        }

        AccountEntity account = new AccountEntity();
        account.setUsername(username);
        account.setFullName(request.fullName().trim());
        account.setRole(request.role());
        account.setDepartment(request.department().trim());
        account.setActive(request.active() == null ? Boolean.TRUE : request.active());
        account.setPasswordHash(passwordHasher.hash(request.password()));
        account.setCreatedAt(LocalDateTime.now());
        account.setPrivileges(serializePrivileges(resolveRequestedPrivileges(request.role(), request.privileges())));

        return toUserResponse(accountRepository.save(account));
    }

    public UserAccountResponse updateUser(Long id, UpdateUserRequest request, String rawRole) {
        requireAdmin(rawRole);
        AccountEntity account = accountRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));

        account.setFullName(request.fullName().trim());
        account.setRole(request.role());
        account.setDepartment(request.department().trim());
        if (request.active() != null) {
            account.setActive(request.active());
        }
        account.setPrivileges(serializePrivileges(resolveRequestedPrivileges(request.role(), request.privileges())));

        if (request.password() != null && !request.password().isBlank()) {
            account.setPasswordHash(passwordHasher.hash(request.password()));
        }

        return toUserResponse(accountRepository.save(account));
    }

    public List<Map<String, String>> listPrivileges(String rawRole) {
        requireAdmin(rawRole);
        return SystemPrivilege.catalog();
    }

    public void requireAdmin(String rawRole) {
        if (rawRole == null || rawRole.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Please sign in again as an administrator.");
        }
        UserRole role = accessService.resolveRole(rawRole);
        if (role != UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required");
        }
    }

    public Set<SystemPrivilege> resolvePrivileges(AccountEntity account) {
        if (account == null) {
            return Set.of();
        }
        Set<SystemPrivilege> stored = SystemPrivilege.parseStored(account.getPrivileges());
        if (!stored.isEmpty()) {
            return stored;
        }
        return SystemPrivilege.defaultsFor(account.getRole());
    }

    public List<String> resolvePrivilegeCodes(AccountEntity account) {
        return resolvePrivileges(account).stream()
                .map(Enum::name)
                .sorted()
                .toList();
    }

    private Set<SystemPrivilege> resolveRequestedPrivileges(UserRole role, List<String> requested) {
        Set<SystemPrivilege> privileges = requested == null || requested.isEmpty()
                ? SystemPrivilege.defaultsFor(role)
                : requested.stream()
                        .map(value -> SystemPrivilege.valueOf(value.trim().toUpperCase(Locale.ROOT)))
                        .collect(Collectors.toCollection(() -> EnumSet.noneOf(SystemPrivilege.class)));

        if (role == UserRole.ADMIN) {
            return EnumSet.allOf(SystemPrivilege.class);
        }
        return privileges;
    }

    private String serializePrivileges(Set<SystemPrivilege> privileges) {
        return SystemPrivilege.serialize(privileges);
    }

    private UserAccountResponse toUserResponse(AccountEntity account) {
        UserRole role = account.getRole();
        return new UserAccountResponse(
                account.getId(),
                account.getUsername(),
                account.getFullName(),
                role.name(),
                role.getDisplayName(),
                account.getDepartment(),
                Boolean.TRUE.equals(account.getActive()),
                resolvePrivilegeCodes(account),
                account.getCreatedAt(),
                account.getLastLoginAt()
        );
    }

    private String normalizeUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username is required");
        }
        return username.trim().toLowerCase(Locale.ROOT);
    }
}
