package com.auca.archive.service;

import com.auca.archive.domain.UserRole;
import com.auca.archive.model.FolderEntity;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ArchiveAccessServiceStructureOwnershipTest {

    private final ArchiveAccessService accessService = new ArchiveAccessService();

    @Test
    void librarianDoesNotSeeRegistrarAcademicYearBranch() {
        FolderEntity department = folder(1L, null, "Software Engineering", "FAC-IT-DEPT-SEN");
        FolderEntity registrarYear = folder(2L, 1L, "2025-2026", "FAC-IT-DEPT-SEN-AY-20252026");
        registrarYear.setOwnerRole(UserRole.REGISTRAR);
        FolderEntity registrarSemester = folder(3L, 2L, "2025/1", "FAC-IT-DEPT-SEN-AY-20252026-SEM-2025-1");
        registrarSemester.setOwnerRole(UserRole.REGISTRAR);

        Map<Long, FolderEntity> folderById = Map.of(
                1L, department,
                2L, registrarYear,
                3L, registrarSemester
        );

        assertTrue(accessService.canViewStructureFolder(registrarYear, UserRole.REGISTRAR, folderById));
        assertTrue(accessService.canViewStructureFolder(registrarYear, UserRole.ADMIN, folderById));
        assertFalse(accessService.canViewStructureFolder(registrarYear, UserRole.LIBRARIAN, folderById));
        assertFalse(accessService.canViewStructureFolder(registrarSemester, UserRole.LIBRARIAN, folderById));
    }

    @Test
    void registrarDoesNotSeeLibrarianAcademicYearBranch() {
        FolderEntity department = folder(1L, null, "Software Engineering", "FAC-IT-DEPT-SEN");
        FolderEntity librarianYear = folder(2L, 1L, "2029-2030", "FAC-IT-DEPT-SEN-AY-20292030-LIB");
        librarianYear.setOwnerRole(UserRole.LIBRARIAN);
        FolderEntity librarianSemester = folder(3L, 2L, "2029/1", "FAC-IT-DEPT-SEN-AY-20292030-LIB-SEM-2029-1");
        librarianSemester.setOwnerRole(UserRole.LIBRARIAN);

        Map<Long, FolderEntity> folderById = Map.of(
                1L, department,
                2L, librarianYear,
                3L, librarianSemester
        );

        assertTrue(accessService.canViewStructureFolder(librarianYear, UserRole.LIBRARIAN, folderById));
        assertFalse(accessService.canViewStructureFolder(librarianYear, UserRole.REGISTRAR, folderById));
    }

    @Test
    void legacySeededYearWithoutOwnerRoleIsRegistrarOwned() {
        FolderEntity legacyYear = folder(2L, 1L, "2024-2025", "FAC-IT-DEPT-SEN-AY-20242025");
        Map<Long, FolderEntity> folderById = Map.of(2L, legacyYear);

        assertTrue(accessService.canViewStructureFolder(legacyYear, UserRole.REGISTRAR, folderById));
        assertFalse(accessService.canViewStructureFolder(legacyYear, UserRole.LIBRARIAN, folderById));
    }

    @Test
    void registrarDoesNotSeeExaminationAcademicYearBranch() {
        FolderEntity department = folder(1L, null, "Software Engineering", "FAC-IT-DEPT-SEN");
        FolderEntity examYear = folder(2L, 1L, "2029-2030", "FAC-IT-DEPT-SEN-AY-20292030-EXAM");
        examYear.setOwnerRole(UserRole.EXAMINATION_OFFICER);
        FolderEntity examSemester = folder(3L, 2L, "2029/1", "FAC-IT-DEPT-SEN-AY-20292030-EXAM-SEM-2029-1");
        examSemester.setOwnerRole(UserRole.EXAMINATION_OFFICER);

        Map<Long, FolderEntity> folderById = Map.of(
                1L, department,
                2L, examYear,
                3L, examSemester
        );

        assertTrue(accessService.canViewStructureFolder(examYear, UserRole.EXAMINATION_OFFICER, folderById));
        assertFalse(accessService.canViewStructureFolder(examYear, UserRole.REGISTRAR, folderById));
        assertFalse(accessService.canViewStructureFolder(examYear, UserRole.LIBRARIAN, folderById));
    }

    @Test
    void registrarDoesNotSeeFinanceAcademicYearBranch() {
        FolderEntity department = folder(1L, null, "Accounting", "FAC-FBA-DEPT-ACCOUNTING");
        FolderEntity financeYear = folder(2L, 1L, "2025-2026", "FAC-FBA-DEPT-ACCOUNTING-AY-20252026-FIN");
        financeYear.setOwnerRole(UserRole.FINANCE);

        Map<Long, FolderEntity> folderById = Map.of(1L, department, 2L, financeYear);

        assertTrue(accessService.canViewStructureFolder(financeYear, UserRole.FINANCE, folderById));
        assertFalse(accessService.canViewStructureFolder(financeYear, UserRole.REGISTRAR, folderById));
    }

    @Test
    void financeAcademicYearWithoutOwnerRoleIsInferredFromFolderCode() {
        FolderEntity financeYear = folder(2L, 1L, "2025-2026", "FAC-FBA-DEPT-ACCOUNTING-AY-20252026-FIN");
        Map<Long, FolderEntity> folderById = Map.of(2L, financeYear);

        assertTrue(accessService.canViewStructureFolder(financeYear, UserRole.FINANCE, folderById));
        assertFalse(accessService.canViewStructureFolder(financeYear, UserRole.REGISTRAR, folderById));
    }

    private FolderEntity folder(Long id, Long parentId, String name, String code) {
        FolderEntity folder = new FolderEntity(name, code, parentId);
        folder.setId(id);
        return folder;
    }
}
