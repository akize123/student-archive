package com.auca.archive.config;

import com.auca.archive.domain.UserRole;
import com.auca.archive.service.AccountService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Locale;
import java.util.Optional;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class StudentSessionFilter extends OncePerRequestFilter {
    private static final String ROLE_HEADER = "X-User-Role";
    private static final String ACCOUNT_HEADER = "X-Account-Id";
    private static final String STUDENT_HEADER = "X-Student-Number";

    private final AccountService accountService;

    public StudentSessionFilter(AccountService accountService) {
        this.accountService = accountService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        HttpServletRequest effectiveRequest = request;
        if (isStudentRequest(request)) {
            String headerStudentNumber = request.getHeader(STUDENT_HEADER);
            if (headerStudentNumber == null || headerStudentNumber.isBlank()) {
                Optional<String> linkedStudentNumber = resolveLinkedStudentNumber(request);
                if (linkedStudentNumber.isPresent()) {
                    MutableHeaderHttpServletRequest wrapped = new MutableHeaderHttpServletRequest(request);
                    wrapped.setHeader(STUDENT_HEADER, linkedStudentNumber.get());
                    effectiveRequest = wrapped;
                }
            }
        }
        filterChain.doFilter(effectiveRequest, response);
    }

    private boolean isStudentRequest(HttpServletRequest request) {
        String role = request.getHeader(ROLE_HEADER);
        return role != null && UserRole.STUDENT.name().equalsIgnoreCase(role.trim());
    }

    private Optional<String> resolveLinkedStudentNumber(HttpServletRequest request) {
        String rawAccountId = request.getHeader(ACCOUNT_HEADER);
        if (rawAccountId == null || rawAccountId.isBlank()) {
            return Optional.empty();
        }
        try {
            return accountService.resolveLinkedStudentNumber(Long.parseLong(rawAccountId.trim()));
        } catch (NumberFormatException ex) {
            return Optional.empty();
        }
    }
}
