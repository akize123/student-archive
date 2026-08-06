package com.auca.archive.service;

import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.domain.SharePermission;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.model.DocumentEntity;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.model.StudentEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ArchiveAccessServiceDeanScopeTest {
    private ArchiveAccessService accessService;

    @BeforeEach
    void setUp() {
        accessService = new ArchiveAccessService();
    }

    @Test
    void requireDeanFacultyRejectsBlankFaculty() {
        assertThrows(IllegalArgumentException.class, () -> accessService.requireDeanFaculty(UserRole.DEAN_OF_FACULTY, ""));
        accessService.requireDeanFaculty(UserRole.REGISTRAR, "");
    }

    @Test
    void rejectDeanApprovalBlocksDocumentReview() {
        assertThrows(IllegalArgumentException.class, () -> accessService.rejectDeanApproval(UserRole.DEAN_OF_FACULTY));
        accessService.rejectDeanApproval(UserRole.HOD);
    }

    @Test
    void deanSeesAllDepartmentsInAssignedFaculty() {
        FolderEntity root = folder(1L, null, "AUCA Archive", "AUCA");
        FolderEntity faculty = folder(2L, 1L, "Faculty of Information Technology", "FAC-IT");
        FolderEntity networking = folder(3L, 2L, "Networking & Communication Systems", "FAC-IT-DEPT-NET");
        FolderEntity software = folder(4L, 2L, "Software Engineering", "FAC-IT-DEPT-SE");
        FolderEntity semester = folder(5L, 3L, "2024/1", "FAC-IT-DEPT-NET-AY-20242025-SEM-1");
        Map<Long, FolderEntity> byId = Map.of(
                1L, root,
                2L, faculty,
                3L, networking,
                4L, software,
                5L, semester
        );

        assertTrue(accessService.deanShouldIncludeFacultyChild(faculty, "Faculty of Information Technology"));
        assertFalse(accessService.deanShouldIncludeFacultyChild(faculty, "Faculty of Business Administration"));
        assertTrue(accessService.deanShouldIncludeDepartmentChild(networking, "Faculty of Information Technology"));
        assertTrue(accessService.deanShouldIncludeDepartmentChild(software, "Faculty of Information Technology"));
        assertTrue(accessService.isFolderInDeanFaculty(semester, "Faculty of Information Technology", byId));
        assertFalse(accessService.isFolderInDeanFaculty(semester, "Faculty of Business Administration", byId));
    }

    @Test
    void documentUsesStoredDepartmentBeforeFolderWalk() {
        DocumentEntity document = new DocumentEntity();
        document.setDepartment("Software Engineering");
        document.setFolderId(99L);

        assertTrue(accessService.isDocumentInDeanFaculty(document, "Faculty of Information Technology", Map.of()));
        assertFalse(accessService.isDocumentInDeanFaculty(document, "Faculty of Business Administration", Map.of()));
    }

    @Test
    void deanCanViewRegistrarOwnedStructureOnly() {
        FolderEntity registrarYear = folder(10L, 2L, "2024-2025", "FAC-IT-DEPT-SE-AY-20242025");
        registrarYear.setOwnerRole(UserRole.REGISTRAR);
        FolderEntity financeYear = folder(11L, 2L, "2024-2025", "FAC-IT-DEPT-SE-AY-20242025-FIN");
        financeYear.setOwnerRole(UserRole.FINANCE);
        Map<Long, FolderEntity> byId = Map.of(10L, registrarYear, 11L, financeYear);

        assertTrue(accessService.canViewStructureFolder(registrarYear, UserRole.DEAN_OF_FACULTY, byId));
        assertFalse(accessService.canViewStructureFolder(financeYear, UserRole.DEAN_OF_FACULTY, byId));
    }

    @Test
    void deanCanViewRegistrarExamAndApplicationCategories() {
        assertTrue(accessService.canViewOfficeDocument(
                document(StudentDocumentCategory.REGISTRATION_FORM, null, null),
                UserRole.DEAN_OF_FACULTY
        ));
        assertTrue(accessService.canViewOfficeDocument(
                document(StudentDocumentCategory.REINTEGRATION_FORM, null, null),
                UserRole.DEAN_OF_FACULTY
        ));
        assertTrue(accessService.canViewOfficeDocument(
                document(StudentDocumentCategory.EXAMINATION_DOCUMENTS, null, null),
                UserRole.DEAN_OF_FACULTY
        ));
        assertTrue(accessService.canViewOfficeDocument(
                document(StudentDocumentCategory.APPLICATION_DOCUMENTS, null, null),
                UserRole.DEAN_OF_FACULTY
        ));
        assertFalse(accessService.canViewOfficeDocument(
                document(StudentDocumentCategory.REGISTRATION_FORM, null, null),
                UserRole.HOD
        ));
    }

    @Test
    void deanCanViewApprovedFinalYearProjectsOnly() {
        DocumentEntity approved = document(StudentDocumentCategory.FINAL_YEAR_PROJECT, DocumentStatus.APPROVED, UserRole.STUDENT);
        DocumentEntity pending = document(StudentDocumentCategory.FINAL_YEAR_PROJECT, DocumentStatus.PENDING, UserRole.STUDENT);

        assertTrue(accessService.canViewOfficeDocument(approved, UserRole.DEAN_OF_FACULTY));
        assertFalse(accessService.canViewOfficeDocument(pending, UserRole.DEAN_OF_FACULTY));
    }

    @Test
    void deanCanUploadRegistrarDocumentCategories() {
        assertTrue(accessService.canUploadCategory(UserRole.DEAN_OF_FACULTY, StudentDocumentCategory.REGISTRATION_FORM));
        assertTrue(accessService.canUploadCategory(UserRole.DEAN_OF_FACULTY, StudentDocumentCategory.APPLICATION_DOCUMENTS));
        assertFalse(accessService.canUploadCategory(UserRole.DEAN_OF_FACULTY, StudentDocumentCategory.EXAMINATION_DOCUMENTS));
    }

    @Test
    void requireStudentInDeanFacultyUsesFriendlyMismatchMessage() {
        StudentEntity student = new StudentEntity();
        student.setFaculty("Faculty of Business Administration");
        student.setDepartment("Business Administration");

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> accessService.requireStudentInDeanFaculty(student, "Faculty of Information Technology")
        );
        assertTrue(error.getMessage().contains("Faculty of Business Administration"));
        assertTrue(error.getMessage().contains("Faculty of Information Technology"));
    }

    @Test
    void requireDeanFacultyMatchRejectsWrongArchiveLocation() {
        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> accessService.requireDeanFacultyMatch(
                        UserRole.DEAN_OF_FACULTY,
                        "Faculty of Information Technology",
                        "Faculty of Business Administration"
                )
        );
        assertTrue(error.getMessage().contains("Faculty of Business Administration"));
    }

    private static DocumentEntity document(
            StudentDocumentCategory category,
            DocumentStatus status,
            UserRole uploadedByRole
    ) {
        DocumentEntity document = new DocumentEntity();
        document.setCategory(category);
        document.setStatus(status);
        document.setUploadedByRole(uploadedByRole);
        return document;
    }

    private static FolderEntity folder(Long id, Long parentId, String name, String code) {
        FolderEntity entity = new FolderEntity();
        entity.setId(id);
        entity.setParentId(parentId);
        entity.setName(name);
        entity.setCode(code);
        return entity;
    }
}
