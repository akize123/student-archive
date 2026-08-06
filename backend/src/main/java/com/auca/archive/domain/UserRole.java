package com.auca.archive.domain;

public enum UserRole {
    ADMIN("System Administrator", "System Maintenance Dashboard", "ICT Office", "admin"),
    REGISTRAR("Registrar", "Registrar Dashboard", "Registrar Office", "registrar"),
    FINANCE("Finance Officer", "Finance Dashboard", "Finance Office", "finance"),
    EXAMINATION_OFFICER("Examination Officer", "Examination Dashboard", "Examination Office", "examination-officer"),
    HOD("HOD", "HOD Dashboard", "Department Office", "hod"),
    DEAN_OF_FACULTY("Dean of Faculty", "Dean Dashboard", "Faculty Office", "dean-of-faculty"),
    LIBRARIAN("Librarian", "Library Dashboard", "University Library", "librarian"),
    STUDENT("Student", "Student Dashboard", "Student Workspace", "student");

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

    public boolean isRegistrarOffice() {
        return this == REGISTRAR;
    }

    public boolean isFinanceOffice() {
        return this == FINANCE;
    }

    public boolean isIndependentOffice() {
        return this == REGISTRAR
                || this == FINANCE
                || this == EXAMINATION_OFFICER
                || this == HOD;
    }

    /** Roles that may use ZIP/folder Import (Year → Semester → Document type → Subcategory). */
    public boolean canImportIntoArchive() {
        return this == REGISTRAR
                || this == FINANCE
                || this == EXAMINATION_OFFICER
                || this == HOD
                || this == DEAN_OF_FACULTY
                || this == ADMIN;
    }
}
