package com.auca.archive.service;

import com.auca.archive.domain.UserRole;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.model.StudentEntity;
import com.auca.archive.repository.FolderRepository;
import com.auca.archive.repository.StudentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentEnrollmentServiceTest {
    @Mock
    private StudentRepository studentRepository;
    @Mock
    private FolderRepository folderRepository;
    @Mock
    private ArchiveAccessService accessService;
    @Mock
    private StudentIdFormatService studentIdFormatService;

    private StudentEnrollmentService enrollmentService;

    @BeforeEach
    void setUp() {
        enrollmentService = new StudentEnrollmentService(
                studentRepository,
                folderRepository,
                accessService,
                studentIdFormatService
        );
        when(studentIdFormatService.normalizeStaffFolderName(anyString())).thenAnswer(invocation ->
                invocation.getArgument(0, String.class).trim().toUpperCase(java.util.Locale.ROOT));
    }

    @Test
    void recognizesRegistrarStudentFolderAsEnrollment() {
        StudentEntity student = new StudentEntity("25883", "Demo Student");
        FolderEntity department = folder(1L, null, "Management", "FAC-FBA-DEPT-MANAGEMENT");
        FolderEntity year = folder(2L, 1L, "2025-2026", "FAC-FBA-DEPT-MANAGEMENT-AY-20252026");
        year.setOwnerRole(UserRole.REGISTRAR);
        FolderEntity semester = folder(3L, 2L, "2025/1", "FAC-FBA-DEPT-MANAGEMENT-AY-20252026-SEM-2025-1");
        semester.setOwnerRole(UserRole.REGISTRAR);
        FolderEntity studentFolder = folder(4L, 3L, "25883", "FAC-FBA-DEPT-MANAGEMENT-AY-20252026-SEM-2025-1-STU-25883");

        when(studentRepository.findByStudentNumber("25883")).thenReturn(Optional.of(student));
        when(folderRepository.findByArchivedAtIsNull()).thenReturn(List.of(department, year, semester, studentFolder));
        when(accessService.resolveStructureOwnerRole(studentFolder, folderMap(department, year, semester, studentFolder)))
                .thenReturn(UserRole.REGISTRAR);

        assertTrue(enrollmentService.isRegisteredByRegistrar("25883"));
    }

    @Test
    void financeBranchStudentFolderDoesNotCountAsRegistrarEnrollment() {
        StudentEntity student = new StudentEntity("25883", "Demo Student");
        FolderEntity financeYear = folder(2L, 1L, "2025-2026", "FAC-FBA-DEPT-MANAGEMENT-AY-20252026-FIN");
        financeYear.setOwnerRole(UserRole.FINANCE);
        FolderEntity financeSemester = folder(3L, 2L, "2025/1", "FAC-FBA-DEPT-MANAGEMENT-AY-20252026-FIN-SEM-2025-1");
        financeSemester.setOwnerRole(UserRole.FINANCE);
        FolderEntity financeStudent = folder(4L, 3L, "25883", "FAC-FBA-DEPT-MANAGEMENT-AY-20252026-FIN-SEM-2025-1-STU-25883");

        when(studentRepository.findByStudentNumber("25883")).thenReturn(Optional.of(student));
        when(folderRepository.findByArchivedAtIsNull()).thenReturn(List.of(financeYear, financeSemester, financeStudent));
        when(accessService.resolveStructureOwnerRole(financeStudent, folderMap(financeYear, financeSemester, financeStudent)))
                .thenReturn(UserRole.FINANCE);

        assertFalse(enrollmentService.isRegisteredByRegistrar("25883"));
    }

    @Test
    void requireRegistrarEnrollmentThrowsForUnknownStudent() {
        when(studentRepository.findByStudentNumber("99999")).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> enrollmentService.requireRegistrarEnrollment("99999"));
    }

    private FolderEntity folder(Long id, Long parentId, String name, String code) {
        FolderEntity folder = new FolderEntity(name, code, parentId);
        folder.setId(id);
        return folder;
    }

    private java.util.Map<Long, FolderEntity> folderMap(FolderEntity... folders) {
        return java.util.Arrays.stream(folders)
                .collect(java.util.stream.Collectors.toMap(FolderEntity::getId, folder -> folder, (left, right) -> left));
    }
}
