package com.auca.archive.service;

import com.auca.archive.dto.FolderNodeResponse;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.repository.DocumentRepository;
import com.auca.archive.repository.FolderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FolderServiceTest {
    @Mock
    private FolderRepository folderRepository;

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private ArchiveAccessService accessService;

    @Mock
    private ActivityService activityService;

    @Test
    void getTreeHandlesRootFoldersWithNullParentIds() {
        FolderEntity root = new FolderEntity("Student Documents", "STD", null);
        root.setId(1L);

        FolderEntity child = new FolderEntity("Registration Forms", "SREG", 1L);
        child.setId(2L);

        when(folderRepository.findAll()).thenReturn(List.of(root, child));
        when(documentRepository.findByFolderId(anyLong())).thenReturn(List.of());

        FolderService folderService = new FolderService(folderRepository, documentRepository, accessService, activityService);

        List<FolderNodeResponse> tree = folderService.getTree();

        assertThat(tree).hasSize(1);
        assertThat(tree.get(0).name()).isEqualTo("Student Documents");
        assertThat(tree.get(0).children()).hasSize(1);
        assertThat(tree.get(0).children().get(0).name()).isEqualTo("Registration Forms");
    }
}
