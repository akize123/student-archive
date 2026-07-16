package com.auca.archive.service;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.SystemPrivilege;
import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.AdminActivityPageResponse;
import com.auca.archive.dto.AdminDashboardResponse;
import com.auca.archive.dto.AdminOfficeMemberResponse;
import com.auca.archive.dto.AdminOfficeResponse;
import com.auca.archive.dto.ArchiveTemplateNodeResponse;
import com.auca.archive.dto.CreateUserRequest;
import com.auca.archive.dto.FolderNodeResponse;
import com.auca.archive.dto.RequestActor;
import com.auca.archive.dto.UpdateUserRequest;
import com.auca.archive.dto.UserAccountResponse;
import com.auca.archive.dto.ActivityScope;
import com.auca.archive.model.AccountEntity;
import com.auca.archive.repository.AccountRepository;
import com.auca.archive.repository.ActivityEntryRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
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
    private static final Map<UserRole, OfficeMeta> OFFICE_META = Map.of(
            UserRole.REGISTRAR, new OfficeMeta(
                    "Registrar",
                    "Registrar Office",
                    "Registration, reintegration, and application archive work.",
                    List.of("REGISTRATION_FORM", "REINTEGRATION_FORM", "APPLICATION_DOCUMENTS")
            ),
            UserRole.EXAMINATION_OFFICER, new OfficeMeta(
                    "Examination Office",
                    "Examination Office",
                    "Exam papers, marks, and course-level archive work.",
                    List.of("EXAMINATION_DOCUMENTS")
            ),
            UserRole.HOD, new OfficeMeta(
                    "Head of Department",
                    "Department Office",
                    "Department approvals and application submissions.",
                    List.of("APPLICATION_DOCUMENTS")
            ),
            UserRole.LIBRARIAN, new OfficeMeta(
                    "Librarian",
                    "University Library",
                    "Final year project review and archive approval.",
                    List.of("FINAL_YEAR_PROJECT")
            ),
            UserRole.STUDENT, new OfficeMeta(
                    "Student",
                    "Student Workspace",
                    "Student project uploads and personal archive files.",
                    List.of("FINAL_YEAR_PROJECT")
            )
    );

    private static final List<UserRole> OFFICE_ORDER = List.of(
            UserRole.REGISTRAR,
            UserRole.EXAMINATION_OFFICER,
            UserRole.HOD,
            UserRole.LIBRARIAN,
            UserRole.STUDENT
    );

    private final AccountRepository accountRepository;
    private final PasswordHasher passwordHasher;
    private final ArchiveAccessService accessService;
    private final ActivityService activityService;
    private final ActivityEntryRepository activityEntryRepository;
    private final FolderService folderService;
    private final StudentAccountProvisioningService studentAccountProvisioningService;

    public AdminService(
            AccountRepository accountRepository,
            PasswordHasher passwordHasher,
            ArchiveAccessService accessService,
            ActivityService activityService,
            ActivityEntryRepository activityEntryRepository,
            FolderService folderService,
            StudentAccountProvisioningService studentAccountProvisioningService
    ) {
        this.accountRepository = accountRepository;
        this.passwordHasher = passwordHasher;
        this.accessService = accessService;
        this.activityService = activityService;
        this.activityEntryRepository = activityEntryRepository;
        this.folderService = folderService;
        this.studentAccountProvisioningService = studentAccountProvisioningService;
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

    public UserAccountResponse createUser(CreateUserRequest request, String rawRole, RequestActor actor) {
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
        applyStudentProfile(
                account,
                request.role(),
                request.studentNumber(),
                request.fullName(),
                request.faculty(),
                request.academicDepartment(),
                null
        );

        UserAccountResponse saved = toUserResponse(accountRepository.save(account));
        activityService.recordAction(
                "Created user account \"" + saved.fullName() + "\" (" + saved.username() + ")",
                actor.resolvedActorLabel("Administrator"),
                ActivityCategory.SYNC,
                ActivityScope.builder()
                        .sourceRole(UserRole.ADMIN)
                        .targetRole(request.role())
                        .academicDepartment(saved.department())
                        .build(),
                actor
        );
        return saved;
    }

    public UserAccountResponse updateUser(Long id, UpdateUserRequest request, String rawRole, RequestActor actor) {
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

        applyStudentProfile(
                account,
                request.role(),
                request.studentNumber(),
                request.fullName(),
                request.faculty(),
                request.academicDepartment(),
                account.getId()
        );

        UserAccountResponse saved = toUserResponse(accountRepository.save(account));
        activityService.recordAction(
                "Updated user account \"" + saved.fullName() + "\" (" + saved.username() + ")",
                actor.resolvedActorLabel("Administrator"),
                ActivityCategory.SYNC,
                ActivityScope.builder()
                        .sourceRole(UserRole.ADMIN)
                        .targetRole(request.role())
                        .academicDepartment(saved.department())
                        .build(),
                actor
        );
        return saved;
    }

    public List<Map<String, String>> listPrivileges(String rawRole) {
        requireAdmin(rawRole);
        return SystemPrivilege.catalog();
    }

    public AdminActivityPageResponse listActivity(
            String rawRole,
            String scopeRole,
            Long userId,
            String category,
            int page,
            int size
    ) {
        requireAdmin(rawRole);
        return activityService.adminActivity(scopeRole, userId, category, page, size);
    }

    public List<AdminOfficeResponse> listOffices(String rawRole) {
        requireAdmin(rawRole);
        List<AccountEntity> accounts = accountRepository.findAll().stream()
                .filter(account -> account.getRole() != UserRole.ADMIN)
                .toList();

        Map<UserRole, List<AccountEntity>> grouped = accounts.stream()
                .collect(Collectors.groupingBy(AccountEntity::getRole, LinkedHashMap::new, Collectors.toList()));

        List<AdminOfficeResponse> offices = new ArrayList<>();
        for (UserRole role : OFFICE_ORDER) {
            offices.add(toOfficeResponse(role, grouped.getOrDefault(role, List.of())));
        }
        grouped.keySet().stream()
                .filter(role -> !OFFICE_ORDER.contains(role))
                .sorted(Comparator.comparing(Enum::name))
                .forEach(role -> offices.add(toOfficeResponse(role, grouped.get(role))));
        return offices;
    }

    public List<ArchiveTemplateNodeResponse> archiveTemplate(String rawRole) {
        requireAdmin(rawRole);
        return folderService.getTree(UserRole.ADMIN.name()).stream()
                .map(this::toTemplateNode)
                .toList();
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

    private AdminOfficeResponse toOfficeResponse(UserRole role, List<AccountEntity> members) {
        OfficeMeta meta = OFFICE_META.getOrDefault(role, new OfficeMeta(
                role.getDisplayName(),
                role.getDepartment(),
                "Live archive activity for " + role.getDisplayName() + ".",
                List.of()
        ));
        List<AdminOfficeMemberResponse> memberResponses = members.stream()
                .sorted(Comparator.comparing(AccountEntity::getFullName, String.CASE_INSENSITIVE_ORDER))
                .map(member -> new AdminOfficeMemberResponse(
                        member.getId(),
                        member.getUsername(),
                        member.getFullName(),
                        Boolean.TRUE.equals(member.getActive()),
                        activityEntryRepository.countByActorAccountId(member.getId())
                ))
                .toList();
        long recentActivityCount = activityEntryRepository.countBySourceRole(role);
        return new AdminOfficeResponse(
                role.name(),
                meta.label(),
                meta.department(),
                meta.summary(),
                members.size(),
                recentActivityCount,
                meta.categories(),
                memberResponses
        );
    }

    private ArchiveTemplateNodeResponse toTemplateNode(FolderNodeResponse node) {
        if (node == null) {
            return new ArchiveTemplateNodeResponse(null, "", "", List.of());
        }
        String code = node.code() == null ? "" : node.code().toUpperCase(Locale.ROOT);
        if (code.contains("-STU-") || code.contains("-SOFF") || code.contains("-SMY") || code.contains("-SARC")) {
            return null;
        }
        List<ArchiveTemplateNodeResponse> children = node.children() == null
                ? List.of()
                : node.children().stream()
                        .map(this::toTemplateNode)
                        .filter(child -> child != null)
                        .toList();
        return new ArchiveTemplateNodeResponse(node.id(), node.name(), node.code(), children);
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
                account.getStudentNumber(),
                account.getCreatedAt(),
                account.getLastLoginAt()
        );
    }

    private void applyStudentProfile(
            AccountEntity account,
            UserRole role,
            String studentNumber,
            String fullName,
            String faculty,
            String academicDepartment,
            Long excludeAccountId
    ) {
        if (role != UserRole.STUDENT) {
            account.setStudentNumber(null);
            return;
        }
        studentAccountProvisioningService.linkStudentAccount(
                account,
                studentNumber,
                fullName,
                faculty,
                academicDepartment,
                excludeAccountId
        );
    }

    private String normalizeUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username is required");
        }
        return username.trim().toLowerCase(Locale.ROOT);
    }

    private record OfficeMeta(String label, String department, String summary, List<String> categories) {
    }
}
