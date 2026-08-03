package com.auca.archive.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ArchiveAccessServiceIsolationTest {

    @Test
    void semesterStudentRootFolderRequiredForStaffUploadPlacement() {
        assertTrue(ArchiveTreeService.isSemesterStudentRootFolder("FAC-IT-DEPT-SEN-AY-20242025-SEM-1-STU-20251SEN001"));
        assertFalse(ArchiveTreeService.isSemesterStudentRootFolder("FAC-IT-DEPT-SEN-AY-20242025-SEM-1"));
        assertFalse(ArchiveTreeService.isSemesterStudentRootFolder(
                "FAC-IT-DEPT-SEN-AY-20242025-SEM-1-STU-20251SEN001-FLD-REGISTRATIONFORM"));
    }
}
