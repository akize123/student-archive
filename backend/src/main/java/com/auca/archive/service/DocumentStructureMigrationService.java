package com.auca.archive.service;

import com.auca.archive.model.DocumentEntity;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.model.StudentEntity;
import com.auca.archive.repository.DocumentCategoryDefinitionRepository;
import com.auca.archive.repository.DocumentRepository;
import com.auca.archive.repository.DocumentTypeDefinitionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class DocumentStructureMigrationService {
    private static final Logger log = LoggerFactory.getLogger(DocumentStructureMigrationService.class);

    private final DocumentRepository documentRepository;
    private final ArchiveTreeService archiveTreeService;
    private final DocumentTypeDefinitionRepository documentTypeDefinitionRepository;
    private final DocumentCategoryDefinitionRepository documentCategoryDefinitionRepository;
    private final StudentService studentService;

    public DocumentStructureMigrationService(
            DocumentRepository documentRepository,
            ArchiveTreeService archiveTreeService,
            DocumentTypeDefinitionRepository documentTypeDefinitionRepository,
            DocumentCategoryDefinitionRepository documentCategoryDefinitionRepository,
            StudentService studentService
    ) {
        this.documentRepository = documentRepository;
        this.archiveTreeService = archiveTreeService;
        this.documentTypeDefinitionRepository = documentTypeDefinitionRepository;
        this.documentCategoryDefinitionRepository = documentCategoryDefinitionRepository;
        this.studentService = studentService;
    }

    @Transactional
    public MigrationResult migrateAll() {
        int migrated = 0;
        int skipped = 0;
        List<String> messages = new ArrayList<>();
        for (DocumentEntity document : documentRepository.findAll()) {
            if (document.getFolderId() == null) {
                skipped += 1;
                continue;
            }
            try {
                if (migrateDocument(document)) {
                    migrated += 1;
                } else {
                    skipped += 1;
                }
            } catch (Exception ex) {
                skipped += 1;
                messages.add("Document " + document.getId() + ": " + ex.getMessage());
            }
        }
        log.info("Document structure migration complete. migrated={} skipped={}", migrated, skipped);
        return new MigrationResult(migrated, skipped, messages);
    }

    private boolean migrateDocument(DocumentEntity document) {
        StudentEntity student = studentService.findByStudentNumber(document.getStudentNumber()).orElse(null);
        if (student == null) {
            return false;
        }
        var workspace = archiveTreeService.ensureStudentWorkspace(
                student,
                student.getFaculty(),
                student.getDepartment(),
                document.getAcademicYear(),
                document.getSemester(),
                false
        );
        String categoryName = resolveCategoryName(document);
        String typeName = resolveTypeName(document);
        FolderEntity target = archiveTreeService.ensureStudentDocumentPath(
                workspace.studentRoot(),
                document.getAcademicYear(),
                document.getSemester(),
                categoryName,
                typeName
        );
        if (target.getId().equals(document.getFolderId())) {
            return false;
        }
        document.setFolderId(target.getId());
        documentRepository.save(document);
        return true;
    }

    private String resolveCategoryName(DocumentEntity document) {
        if (document.getCategoryDefinitionId() != null) {
            return documentCategoryDefinitionRepository.findById(document.getCategoryDefinitionId())
                    .map(item -> item.getName())
                    .orElseGet(() -> resolveTypeName(document));
        }
        if (document.getDocumentTypeId() != null) {
            return documentTypeDefinitionRepository.findById(document.getDocumentTypeId())
                    .map(type -> {
                        if (type.getCategoryDefinitionId() != null) {
                            return documentCategoryDefinitionRepository.findById(type.getCategoryDefinitionId())
                                    .map(item -> item.getName())
                                    .orElse(type.getCategory() == null ? "Documents" : type.getCategory().getDisplayName());
                        }
                        return type.getCategory() == null ? "Documents" : type.getCategory().getDisplayName();
                    })
                    .orElseGet(() -> resolveTypeName(document));
        }
        if (document.getCategory() != null) {
            return document.getCategory().getDisplayName();
        }
        return "Documents";
    }

    private String resolveTypeName(DocumentEntity document) {
        if (document.getDocumentTypeId() != null) {
            return documentTypeDefinitionRepository.findById(document.getDocumentTypeId())
                    .map(item -> item.getName())
                    .orElse(document.getCategory() == null ? "Documents" : document.getCategory().getDisplayName());
        }
        if (document.getCategory() != null) {
            return document.getCategory().getDisplayName();
        }
        return "Documents";
    }

    public record MigrationResult(int migrated, int skipped, List<String> messages) {
    }
}
