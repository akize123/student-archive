package com.auca.archive.service;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.model.ActivityEntryEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ArchiveAccessServiceActivityVisibilityTest {
    private ArchiveAccessService accessService;

    @BeforeEach
    void setUp() {
        accessService = new ArchiveAccessService();
    }

    @Test
    void examinationOfficerDoesNotSeeLibrarianFinalYearProjectApproval() {
        ActivityEntryEntity entry = scopedActivity(
                ActivityCategory.APPROVAL,
                UserRole.LIBRARIAN,
                UserRole.LIBRARIAN,
                "Software Engineering",
                StudentDocumentCategory.FINAL_YEAR_PROJECT,
                "20251SEN001"
        );

        assertFalse(accessService.isActivityVisible(entry, UserRole.EXAMINATION_OFFICER, "Examination Office", null));
        assertTrue(accessService.isActivityVisible(entry, UserRole.LIBRARIAN, "University Library", null));
    }

    @Test
    void examinationOfficerSeesExaminationDocumentsInTheirDomain() {
        ActivityEntryEntity entry = scopedActivity(
                ActivityCategory.UPLOAD,
                UserRole.EXAMINATION_OFFICER,
                null,
                "Software Engineering",
                StudentDocumentCategory.EXAMINATION_DOCUMENTS,
                null
        );

        assertTrue(accessService.isActivityVisible(entry, UserRole.EXAMINATION_OFFICER, "Examination Office", null));
        assertFalse(accessService.isActivityVisible(entry, UserRole.LIBRARIAN, "University Library", null));
    }

    @Test
    void shareActivityVisibleOnlyToSenderAndReceiver() {
        ActivityEntryEntity entry = scopedActivity(
                ActivityCategory.SHARE,
                UserRole.EXAMINATION_OFFICER,
                UserRole.HOD,
                "Software Engineering",
                null,
                null
        );

        assertTrue(accessService.isActivityVisible(entry, UserRole.EXAMINATION_OFFICER, "Examination Office", null));
        assertTrue(accessService.isActivityVisible(entry, UserRole.HOD, "Software Engineering", null));
        assertFalse(accessService.isActivityVisible(entry, UserRole.REGISTRAR, "Registrar Office", null));
        assertFalse(accessService.isActivityVisible(entry, UserRole.LIBRARIAN, "University Library", null));
    }

    @Test
    void hodSeesOwnDepartmentAndTargetedShareButNotOtherDepartments() {
        ActivityEntryEntity departmentActivity = scopedActivity(
                ActivityCategory.UPLOAD,
                UserRole.HOD,
                null,
                "Software Engineering",
                StudentDocumentCategory.APPLICATION_DOCUMENTS,
                null
        );
        ActivityEntryEntity otherDepartmentActivity = scopedActivity(
                ActivityCategory.UPLOAD,
                UserRole.HOD,
                null,
                "Finance",
                StudentDocumentCategory.APPLICATION_DOCUMENTS,
                null
        );

        assertTrue(accessService.isActivityVisible(departmentActivity, UserRole.HOD, "Software Engineering", null));
        assertFalse(accessService.isActivityVisible(otherDepartmentActivity, UserRole.HOD, "Software Engineering", null));
    }

    @Test
    void studentSeesOwnSubmittedProjectActivity() {
        ActivityEntryEntity entry = scopedActivity(
                ActivityCategory.UPLOAD,
                UserRole.STUDENT,
                UserRole.LIBRARIAN,
                "Software Engineering",
                StudentDocumentCategory.FINAL_YEAR_PROJECT,
                "20251SEN001"
        );

        assertTrue(accessService.isActivityVisible(entry, UserRole.STUDENT, null, "20251SEN001"));
        assertFalse(accessService.isActivityVisible(entry, UserRole.STUDENT, null, "25883"));
    }

    @Test
    void legacyActivitiesWithoutMetadataAreHiddenFromNonAdminRoles() {
        ActivityEntryEntity legacy = new ActivityEntryEntity();
        legacy.setMessage("Librarian approved final year project \"legacy\"");
        legacy.setActor("Librarian");
        legacy.setCategory(ActivityCategory.APPROVAL);

        assertFalse(accessService.isActivityVisible(legacy, UserRole.EXAMINATION_OFFICER, "Examination Office", null));
        assertFalse(accessService.isActivityVisible(legacy, UserRole.LIBRARIAN, "University Library", null));
        assertTrue(accessService.isActivityVisible(legacy, UserRole.ADMIN, null, null));
    }

    private ActivityEntryEntity scopedActivity(
            ActivityCategory category,
            UserRole sourceRole,
            UserRole targetRole,
            String academicDepartment,
            StudentDocumentCategory documentCategory,
            String studentNumber
    ) {
        ActivityEntryEntity entry = new ActivityEntryEntity();
        entry.setCategory(category);
        entry.setSourceRole(sourceRole);
        entry.setTargetRole(targetRole);
        entry.setAcademicDepartment(academicDepartment);
        entry.setDocumentCategory(documentCategory);
        entry.setStudentNumber(studentNumber);
        return entry;
    }
}
