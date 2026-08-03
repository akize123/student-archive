package com.auca.archive.domain;

import java.util.List;
import java.util.Optional;

/**
 * Demo HOD sign-in: short usernames per department, shared password {@code Hod@123}.
 */
public final class HodLoginPasswords {
    public static final String DEMO_PASSWORD = "Hod@123";

    private HodLoginPasswords() {
    }

    public static String demoUsernameForDepartment(String department) {
        if (department == null || department.isBlank()) {
            throw new IllegalArgumentException("Department is required");
        }
        String trimmed = department.trim();
        if ("Accounting".equalsIgnoreCase(trimmed)) {
            return "hod.acc";
        }
        if ("Management".equalsIgnoreCase(trimmed)) {
            return "hod.man";
        }
        if ("Finance".equalsIgnoreCase(trimmed)) {
            return "hod.fin";
        }
        if ("Software Engineering".equalsIgnoreCase(trimmed)) {
            return "hod.sof";
        }
        if ("Networking & Communication Systems".equalsIgnoreCase(trimmed)) {
            return "hod.net";
        }
        if ("Information Management".equalsIgnoreCase(trimmed)) {
            return "hod.inf";
        }
        if ("Educational Psychology".equalsIgnoreCase(trimmed)) {
            return "hod.psy";
        }
        if ("Languages (English / French)".equalsIgnoreCase(trimmed)) {
            return "hod.lan";
        }
        if ("Religious Studies".equalsIgnoreCase(trimmed)) {
            return "hod.rel";
        }
        if ("Business Accounting & Computer Science".equalsIgnoreCase(trimmed)) {
            return "hod.bus";
        }
        if ("Nursing".equalsIgnoreCase(trimmed)) {
            return "hod.nur";
        }
        if ("Midwifery".equalsIgnoreCase(trimmed)) {
            return "hod.mid";
        }
        if ("Theology (Pastoral Training)".equalsIgnoreCase(trimmed)) {
            return "hod.theo";
        }
        throw new IllegalArgumentException("No demo HOD username for department: " + trimmed);
    }

    public static Optional<String> demoPasswordForDepartment(String department) {
        if (!AcademicDepartmentCatalog.isKnownAcademicDepartment(department)) {
            return Optional.empty();
        }
        return Optional.of(DEMO_PASSWORD);
    }

    /** Older demo HOD usernames that should be turned off after the short-username rename. */
    public static List<String> legacyDemoUsernames() {
        return List.of(
                "hod",
                "hod.im",
                "hod.accounting",
                "hod.management",
                "hod.finance",
                "hod.software",
                "hod.information",
                "hod.psychology",
                "hod.languages",
                "hod.religious",
                "hod.bacs",
                "hod.nursing",
                "hod.midwifery",
                "hod.theology"
        );
    }
}
