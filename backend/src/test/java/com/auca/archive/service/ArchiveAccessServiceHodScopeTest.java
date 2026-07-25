package com.auca.archive.service;

import com.auca.archive.domain.UserRole;
import com.auca.archive.model.DocumentEntity;
import com.auca.archive.model.FolderEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ArchiveAccessServiceHodScopeTest {
    private ArchiveAccessService accessService;

    @BeforeEach
    void setUp() {
        accessService = new ArchiveAccessService();
    }

    @Test
    void requireHodDepartmentRejectsBlankDepartment() {
        assertThrows(IllegalArgumentException.class, () -> accessService.requireHodDepartment(UserRole.HOD, ""));
        accessService.requireHodDepartment(UserRole.REGISTRAR, "");
    }

    @Test
    void folderDepartmentResolutionMatchesViewerDepartment() {
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

        assertTrue(accessService.isFolderInHodDepartment(semester, "Networking & Communication Systems", byId));
        assertFalse(accessService.isFolderInHodDepartment(semester, "Software Engineering", byId));
        assertTrue(accessService.hodShouldIncludeDepartmentChild(networking, "Networking & Communication Systems"));
        assertFalse(accessService.hodShouldIncludeDepartmentChild(software, "Networking & Communication Systems"));
    }

    @Test
    void documentUsesStoredDepartmentBeforeFolderWalk() {
        DocumentEntity document = new DocumentEntity();
        document.setDepartment("Software Engineering");
        document.setFolderId(99L);

        assertTrue(accessService.isDocumentInHodDepartment(document, "Software Engineering", Map.of()));
        assertFalse(accessService.isDocumentInHodDepartment(document, "Networking & Communication Systems", Map.of()));
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
