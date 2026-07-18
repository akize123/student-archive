package com.auca.archive.config;

import com.auca.archive.domain.UserRole;
import com.auca.archive.model.AccountEntity;
import com.auca.archive.repository.AccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class AccountAccessFilter extends OncePerRequestFilter {
    private static final String ACCOUNT_HEADER = "X-Account-Id";
    private static final String ROLE_HEADER = "X-User-Role";
    private static final String DEPARTMENT_HEADER = "X-User-Department";
    private static final String ACCESS_VERSION_HEADER = "X-Access-Version";

    private final AccountRepository accountRepository;
    private final ObjectMapper objectMapper;

    public AccountAccessFilter(AccountRepository accountRepository, ObjectMapper objectMapper) {
        this.accountRepository = accountRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        return path == null
                || !path.startsWith("/api/")
                || path.startsWith("/api/auth/login");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String rawAccountId = request.getHeader(ACCOUNT_HEADER);
        if (rawAccountId == null || rawAccountId.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        Optional<AccountEntity> accountOptional;
        try {
            accountOptional = accountRepository.findById(Long.parseLong(rawAccountId.trim()));
        } catch (NumberFormatException ex) {
            writeError(response, HttpStatus.UNAUTHORIZED, "Please sign in again.");
            return;
        }

        AccountEntity account = accountOptional.orElse(null);
        if (account == null) {
            writeError(response, HttpStatus.UNAUTHORIZED, "Please sign in again.");
            return;
        }

        if (!Boolean.TRUE.equals(account.getActive())) {
            writeError(response, HttpStatus.FORBIDDEN, "Access revoked. This account is no longer active.");
            return;
        }

        String roleHeader = request.getHeader(ROLE_HEADER);
        if (roleHeader != null && !roleHeader.isBlank()) {
            try {
                UserRole declaredRole = UserRole.valueOf(roleHeader.trim().toUpperCase(Locale.ROOT));
                if (account.getRole() != declaredRole) {
                    writeError(response, HttpStatus.FORBIDDEN, "Session expired. Sign in again to refresh your role.");
                    return;
                }
            } catch (IllegalArgumentException ex) {
                writeError(response, HttpStatus.FORBIDDEN, "Session expired. Sign in again to refresh your role.");
                return;
            }
        }

        String departmentHeader = request.getHeader(DEPARTMENT_HEADER);
        if (departmentHeader != null
                && !departmentHeader.isBlank()
                && account.getDepartment() != null
                && !account.getDepartment().equalsIgnoreCase(departmentHeader.trim())) {
            writeError(response, HttpStatus.FORBIDDEN, "Session expired. Sign in again to refresh your department access.");
            return;
        }

        String accessVersionHeader = request.getHeader(ACCESS_VERSION_HEADER);
        if (accessVersionHeader != null && !accessVersionHeader.isBlank()) {
            try {
                long declaredVersion = Long.parseLong(accessVersionHeader.trim());
                if (declaredVersion != account.getAccessVersion()) {
                    writeError(response, HttpStatus.FORBIDDEN, "Session expired. Sign in again to restore archive access.");
                    return;
                }
            } catch (NumberFormatException ignored) {
                writeError(response, HttpStatus.FORBIDDEN, "Session expired. Sign in again to restore archive access.");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private void writeError(HttpServletResponse response, HttpStatus status, String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("message", message);
        objectMapper.writeValue(response.getOutputStream(), payload);
    }
}
