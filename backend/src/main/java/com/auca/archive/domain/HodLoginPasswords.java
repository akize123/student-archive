package com.auca.archive.domain;

import java.util.List;
import java.util.Optional;

/**
 * Demo HOD sign-in: one seeded account ({@code hod} / {@code Head@123}) for Software Engineering.
 */
public final class HodLoginPasswords {
    public static final String DEMO_USERNAME = "hod";
    public static final String DEMO_PASSWORD = "Head@123";
    public static final String DEMO_DEPARTMENT = "Software Engineering";

    private HodLoginPasswords() {
    }

    public static String demoUsernameForDepartment(String department) {
        if (department == null || department.isBlank()) {
            throw new IllegalArgumentException("Department is required");
        }
        if (DEMO_DEPARTMENT.equalsIgnoreCase(department.trim())) {
            return DEMO_USERNAME;
        }
        throw new IllegalArgumentException("No demo HOD username for department: " + department.trim());
    }

    public static Optional<String> demoPasswordForDepartment(String department) {
        if (department != null && DEMO_DEPARTMENT.equalsIgnoreCase(department.trim())) {
            return Optional.of(DEMO_PASSWORD);
        }
        return Optional.empty();
    }

    /** Former per-department demo HOD usernames — deactivated on startup. */
    public static List<String> legacyDemoUsernames() {
        return List.of(
                "hod.sof",
                "hod.acc",
                "hod.man",
                "hod.fin",
                "hod.net",
                "hod.inf",
                "hod.psy",
                "hod.lan",
                "hod.rel",
                "hod.bus",
                "hod.nur",
                "hod.mid",
                "hod.theo",
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
