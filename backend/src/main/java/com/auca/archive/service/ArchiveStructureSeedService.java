package com.auca.archive.service;

import com.auca.archive.config.AucaFacultyCatalog;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.repository.FolderRepository;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Objects;

@Service
public class ArchiveStructureSeedService {
    private final FolderRepository folderRepository;
    private final AcademicTermService academicTermService;

    public ArchiveStructureSeedService(FolderRepository folderRepository, AcademicTermService academicTermService) {
        this.folderRepository = folderRepository;
        this.academicTermService = academicTermService;
    }

    public void seedArchiveStructure() {
        FolderEntity archiveRoot = ensureFolder("AUCA Archive", ArchiveTreeService.ROOT_CODE, null);

        for (AucaFacultyCatalog.FacultyEntry faculty : AucaFacultyCatalog.FACULTIES) {
            FolderEntity facultyFolder = ensureFolder(
                    faculty.name(),
                    "FAC-" + faculty.code(),
                    archiveRoot.getId()
            );

            if ("FBA".equalsIgnoreCase(faculty.code())) {
                renameBusinessInformationManagementToManagement(facultyFolder);
            }

            for (String department : faculty.departments()) {
                String departmentCode = facultyFolder.getCode() + "-DEPT-" + sanitizeCode(department);
                FolderEntity departmentFolder = ensureFolder(department, departmentCode, facultyFolder.getId());

                for (String academicYear : AcademicTermService.ACADEMIC_YEARS) {
                    String academicYearCode = academicTermService.buildAcademicYearFolderCode(departmentCode, academicYear);
                    FolderEntity academicYearFolder = ensureFolder(academicYear, academicYearCode, departmentFolder.getId());

                    int startYear = academicTermService.parseStartYear(academicYear);
                    for (int semester = 1; semester <= AcademicTermService.SEMESTERS_PER_YEAR; semester++) {
                        String semesterName = academicTermService.formatSemesterFolderName(startYear, semester);
                        String semesterCode = academicTermService.buildSemesterFolderCode(
                                academicYearCode,
                                startYear,
                                semester
                        );
                        ensureFolder(semesterName, semesterCode, academicYearFolder.getId());
                    }
                }
            }
        }
    }

    private void renameBusinessInformationManagementToManagement(FolderEntity facultyFolder) {
        String legacyCode = facultyFolder.getCode() + "-DEPT-INFORMATIONMANAGEMENT";
        String targetCode = facultyFolder.getCode() + "-DEPT-MANAGEMENT";

        folderRepository.findByCode(legacyCode).ifPresent(legacy -> {
            if (folderRepository.findByCode(targetCode).isEmpty()) {
                legacy.setName("Management");
                legacy.setCode(targetCode);
                folderRepository.save(legacy);
                return;
            }
            deleteFolderTree(legacy.getId());
        });

        folderRepository.findAll().stream()
                .filter(folder -> Objects.equals(folder.getParentId(), facultyFolder.getId()))
                .filter(folder -> "Information Management".equalsIgnoreCase(folder.getName()))
                .forEach(folder -> {
                    if (folderRepository.findByCode(targetCode).isEmpty()) {
                        folder.setName("Management");
                        folder.setCode(targetCode);
                        folderRepository.save(folder);
                    } else if (!targetCode.equalsIgnoreCase(folder.getCode())) {
                        deleteFolderTree(folder.getId());
                    }
                });
    }

    private void deleteFolderTree(Long folderId) {
        folderRepository.findAll().stream()
                .filter(folder -> Objects.equals(folder.getParentId(), folderId))
                .forEach(child -> deleteFolderTree(child.getId()));
        folderRepository.findById(folderId).ifPresent(folderRepository::delete);
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
