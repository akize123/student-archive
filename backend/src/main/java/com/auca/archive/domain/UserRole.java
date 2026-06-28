package com.auca.archive.domain;

public enum UserRole {
    REGISTRAR("Registrar", "Registrar Dashboard", "Registrar Office", "registrar"),
    EXAMINATION_OFFICER("Examination Officer", "Examination Dashboard", "Examination Office", "examination-officer"),
    HOD("HOD", "HOD Dashboard", "Department Office", "hod");

    private final String displayName;
    private final String dashboardTitle;
    private final String department;
    private final String dashboardKey;

    UserRole(String displayName, String dashboardTitle, String department, String dashboardKey) {
        this.displayName = displayName;
        this.dashboardTitle = dashboardTitle;
        this.department = department;
        this.dashboardKey = dashboardKey;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDashboardTitle() {
        return dashboardTitle;
    }

    public String getDepartment() {
        return department;
    }

    public String getDashboardKey() {
        return dashboardKey;
    }
}
