package com.auca.archive.service;

import com.auca.archive.config.AucaFacultyCatalog;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.repository.FolderRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
public class ArchiveStructureSeedService {
    public static final List<String> COHORT_YEARS = List.of(
            "20", "21", "22", "23", "24", "25", "26", "27", "28", "29"
    );

    private final FolderRepository folderRepository;

    public ArchiveStructureSeedService(FolderRepository folderRepository) {
        this.folderRepository = folderRepository;
    }

    public void seedArchiveStructure() {
        FolderEntity archiveRoot = ensureFolder("AUCA Archive", ArchiveTreeService.ROOT_CODE, null);

        for (AucaFacultyCatalog.FacultyEntry faculty : AucaFacultyCatalog.FACULTIES) {
            FolderEntity facultyFolder = ensureFolder(
                    faculty.name(),
                    "FAC-" + faculty.code(),
                    archiveRoot.getId()
            );

            for (String department : faculty.departments()) {
                String departmentCode = facultyFolder.getCode() + "-DEPT-" + sanitizeCode(department);
                FolderEntity departmentFolder = ensureFolder(department, departmentCode, facultyFolder.getId());

                for (StudentDocumentCategory category : StudentDocumentCategory.values()) {
                    ensureFolder(
                            category.getDisplayName(),
                            departmentCode + "-" + category.getFolderCode(),
                            departmentFolder.getId()
                    );
                }

                for (String cohortYear : COHORT_YEARS) {
                    String cohortFolderName = cohortYear + "'s";
                    String cohortCode = departmentCode + "-YR-" + cohortYear;
                    FolderEntity cohortFolder = ensureFolder(cohortFolderName, cohortCode, departmentFolder.getId());

                    for (StudentDocumentCategory category : StudentDocumentCategory.values()) {
                        ensureFolder(
                                category.getDisplayName(),
                                cohortCode + "-" + category.getFolderCode(),
                                cohortFolder.getId()
                        );
                    }
                }
            }
        }
    }

    private FolderEntity ensureFolder(String name, String code, Long parentId) {
        return folderRepository.findByCode(code)
                .map(existing -> {
                    boolean changed = false;
                    if (!Objects.equals(existing.getName(), name)) {
                        existing.setName(name);
                        changed = true;
                    }
                    if (!Objects.equals(existing.getParentId(), parentId)) {
                        existing.setParentId(parentId);
                        changed = true;
                    }
                    return changed ? folderRepository.save(existing) : existing;
                })
                .orElseGet(() -> folderRepository.save(new FolderEntity(name, code, parentId)));
    }

    private String sanitizeCode(String value) {
        if (value == null || value.isBlank()) {
            return "UNKNOWN";
        }
        return value.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }
}
