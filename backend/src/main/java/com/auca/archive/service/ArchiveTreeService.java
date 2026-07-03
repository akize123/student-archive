package com.auca.archive.service;

import com.auca.archive.config.AucaFacultyCatalog;
import com.auca.archive.domain.ExamPaperType;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.dto.UploadDocumentRequest;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.model.StudentEntity;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.Locale;

@Service
public class ArchiveTreeService {
    public static final String ROOT_CODE = "AUCA";

    private final FolderService folderService;
    private final StudentCohortService cohortService;

    public ArchiveTreeService(FolderService folderService, StudentCohortService cohortService) {
        this.folderService = folderService;
        this.cohortService = cohortService;
    }

    public FolderEntity resolveUploadFolder(
            UploadDocumentRequest request,
            StudentEntity student,
            ExamPaperType examPaperType
    ) {
        String faculty = requireText(student.getFaculty(), request.faculty(), "Faculty is required to place this document in the archive tree");
        String department = requireText(student.getDepartment(), request.department(), "Department is required to place this document in the archive tree");
        String studentNumber = student.getStudentNumber();

        FolderEntity root = folderService.getFolderByCodeOrThrow(ROOT_CODE);
        FolderEntity facultyFolder = resolveFacultyFolder(faculty, root.getId());
        FolderEntity departmentFolder = resolveDepartmentFolder(facultyFolder, department);

        String cohortCode = cohortService.resolveCohortCode(studentNumber);
        String cohortFolderName = cohortService.resolveCohortFolderName(studentNumber);
        String yearCode = departmentFolder.getCode() + "-YR-" + cohortCode;
        FolderEntity yearFolder = folderService.resolveOrCreateFolder(cohortFolderName, yearCode, departmentFolder.getId());

        String studentCode = yearFolder.getCode() + "-STU-" + sanitizeCode(studentNumber);
        FolderEntity studentFolder = folderService.resolveOrCreateFolder(studentNumber, studentCode, yearFolder.getId());

        StudentDocumentCategory category = request.category();
        FolderEntity categoryFolder = folderService.resolveOrCreateFolder(
                category.getDisplayName(),
                studentFolder.getCode() + "-" + category.getFolderCode(),
                studentFolder.getId()
        );

        if (category != StudentDocumentCategory.EXAMINATION_DOCUMENTS || examPaperType == null) {
            return categoryFolder;
        }

        FolderEntity typeFolder = folderService.resolveOrCreateFolder(
                examPaperType.getDisplayName(),
                categoryFolder.getCode() + "-" + examPaperType.getFolderCode(),
                categoryFolder.getId()
        );
        FolderEntity academicYearFolder = folderService.resolveOrCreateFolder(
                trim(request.academicYear()),
                typeFolder.getCode() + "-" + sanitizeCode(request.academicYear()),
                typeFolder.getId()
        );
        FolderEntity semesterFolder = folderService.resolveOrCreateFolder(
                trim(request.semester()),
                academicYearFolder.getCode() + "-" + sanitizeCode(request.semester()),
                academicYearFolder.getId()
        );
        return folderService.resolveOrCreateFolder(
                trim(request.course()),
                semesterFolder.getCode() + "-" + sanitizeCode(request.course()),
                semesterFolder.getId()
        );
    }

    public Path resolveStoragePath(
            Path storageRoot,
            UploadDocumentRequest request,
            StudentEntity student,
            ExamPaperType examPaperType
    ) {
        String faculty = requireText(student.getFaculty(), request.faculty(), "Faculty is required");
        String department = requireText(student.getDepartment(), request.department(), "Department is required");
        String studentNumber = student.getStudentNumber();
        String cohortFolderName = cohortService.resolveCohortFolderName(studentNumber);

        Path studentRoot = storageRoot
                .resolve(sanitizePath(faculty))
                .resolve(sanitizePath(department))
                .resolve(sanitizePath(cohortFolderName))
                .resolve(sanitizePath(studentNumber))
                .resolve(sanitizePath(request.category().getFolderCode()));

        if (request.category() != StudentDocumentCategory.EXAMINATION_DOCUMENTS || examPaperType == null) {
            return studentRoot;
        }

        return studentRoot
                .resolve(sanitizePath(examPaperType.getFolderCode()))
                .resolve(sanitizePath(request.academicYear()))
                .resolve(sanitizePath(request.semester()))
                .resolve(sanitizePath(request.course()));
    }

    private FolderEntity resolveFacultyFolder(String facultyName, Long rootId) {
        for (AucaFacultyCatalog.FacultyEntry faculty : AucaFacultyCatalog.FACULTIES) {
            if (faculty.name().equalsIgnoreCase(facultyName.trim())) {
                return folderService.resolveOrCreateFolder(faculty.name(), "FAC-" + faculty.code(), rootId);
            }
        }
        return folderService.resolveOrCreateFolder(facultyName, "FAC-" + sanitizeCode(facultyName), rootId);
    }

    private FolderEntity resolveDepartmentFolder(FolderEntity facultyFolder, String departmentName) {
        String departmentCode = facultyFolder.getCode() + "-DEPT-" + sanitizeCode(departmentName);
        return folderService.resolveOrCreateFolder(departmentName, departmentCode, facultyFolder.getId());
    }

    private String requireText(String primary, String fallback, String message) {
        String value = trim(primary);
        if (value == null) {
            value = trim(fallback);
        }
        if (value == null) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }

    private String trim(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String sanitizeCode(String value) {
        if (value == null || value.isBlank()) {
            return "UNKNOWN";
        }
        return value.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }

    private String sanitizePath(String value) {
        if (value == null || value.isBlank()) {
            return "UNKNOWN";
        }
        return value.replaceAll("[^a-zA-Z0-9._' -]", "_");
    }
}
