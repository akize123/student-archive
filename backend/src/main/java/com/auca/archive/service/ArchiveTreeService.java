package com.auca.archive.service;

import com.auca.archive.config.AucaFacultyCatalog;
import com.auca.archive.domain.ExamPaperType;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.dto.UploadDocumentRequest;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.model.StudentEntity;
import com.auca.archive.repository.FolderRepository;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.Locale;
import java.util.Optional;

@Service
public class ArchiveTreeService {
    public static final String ROOT_CODE = "AUCA";

    private final FolderService folderService;
    private final AcademicTermService academicTermService;
    private final FolderRepository folderRepository;

    public ArchiveTreeService(
            FolderService folderService,
            AcademicTermService academicTermService,
            FolderRepository folderRepository
    ) {
        this.folderService = folderService;
        this.academicTermService = academicTermService;
        this.folderRepository = folderRepository;
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

        AcademicTermService.ResolvedTerm term = academicTermService.resolveTerm(
                studentNumber,
                request.academicYear(),
                request.semester()
        );

        String academicYearCode = academicTermService.buildAcademicYearFolderCode(
                departmentFolder.getCode(),
                term.academicYear()
        );
        FolderEntity academicYearFolder = folderService.resolveOrCreateFolder(
                term.academicYear(),
                academicYearCode,
                departmentFolder.getId()
        );

        String semesterCode = academicTermService.buildSemesterFolderCode(
                academicYearFolder.getCode(),
                term.startYear(),
                term.semesterNumber()
        );
        FolderEntity semesterFolder = folderService.resolveOrCreateFolder(
                term.semesterFolderName(),
                semesterCode,
                academicYearFolder.getId()
        );

        String studentCode = semesterFolder.getCode() + "-STU-" + sanitizeCode(studentNumber);
        FolderEntity studentFolder = folderService.resolveOrCreateFolder(studentNumber, studentCode, semesterFolder.getId());

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
        return folderService.resolveOrCreateFolder(
                trim(request.course()),
                typeFolder.getCode() + "-" + sanitizeCode(request.course()),
                typeFolder.getId()
        );
    }

    public Optional<Long> findStudentFolderId(StudentEntity student) {
        if (student == null || student.getStudentNumber() == null || student.getStudentNumber().isBlank()) {
            return Optional.empty();
        }
        String faculty = trim(student.getFaculty());
        String department = trim(student.getDepartment());
        if (faculty == null || department == null) {
            return Optional.empty();
        }

        Optional<FolderEntity> facultyFolder = findFacultyFolder(faculty);
        if (facultyFolder.isEmpty()) {
            return Optional.empty();
        }
        Optional<FolderEntity> departmentFolder = findDepartmentFolder(facultyFolder.get(), department);
        if (departmentFolder.isEmpty()) {
            return Optional.empty();
        }

        String marker = academicTermService.studentFolderMarker(student.getStudentNumber());
        if (marker == null) {
            return Optional.empty();
        }

        try {
            AcademicTermService.ResolvedTerm term = academicTermService.resolveTerm(student.getStudentNumber(), null, null);
            String academicYearCode = academicTermService.buildAcademicYearFolderCode(
                    departmentFolder.get().getCode(),
                    term.academicYear()
            );
            String semesterCode = academicTermService.buildSemesterFolderCode(
                    academicYearCode,
                    term.startYear(),
                    term.semesterNumber()
            );
            String studentCode = semesterCode + marker;
            Optional<FolderEntity> studentFolder = folderRepository.findByCode(studentCode);
            if (studentFolder.isPresent()) {
                return studentFolder.map(FolderEntity::getId);
            }
        } catch (IllegalArgumentException ignored) {
            // Fall back to any student folder under this department.
        }

        return folderRepository.findFirstByCodeContaining(marker).map(FolderEntity::getId);
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

        AcademicTermService.ResolvedTerm term = academicTermService.resolveTerm(
                studentNumber,
                request.academicYear(),
                request.semester()
        );

        Path studentRoot = storageRoot
                .resolve(sanitizePath(faculty))
                .resolve(sanitizePath(department))
                .resolve(sanitizePath(term.academicYear()))
                .resolve(sanitizePath(term.semesterFolderName()))
                .resolve(sanitizePath(studentNumber))
                .resolve(sanitizePath(request.category().getFolderCode()));

        if (request.category() != StudentDocumentCategory.EXAMINATION_DOCUMENTS || examPaperType == null) {
            return studentRoot;
        }

        return studentRoot
                .resolve(sanitizePath(examPaperType.getFolderCode()))
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

    private Optional<FolderEntity> findFacultyFolder(String facultyName) {
        for (AucaFacultyCatalog.FacultyEntry faculty : AucaFacultyCatalog.FACULTIES) {
            if (faculty.name().equalsIgnoreCase(facultyName.trim())) {
                return folderRepository.findByCode("FAC-" + faculty.code());
            }
        }
        return folderRepository.findByCode("FAC-" + sanitizeCode(facultyName));
    }

    private Optional<FolderEntity> findDepartmentFolder(FolderEntity facultyFolder, String departmentName) {
        String departmentCode = facultyFolder.getCode() + "-DEPT-" + sanitizeCode(departmentName);
        return folderRepository.findByCode(departmentCode);
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
        return value.replaceAll("[^a-zA-Z0-9._' /-]", "_");
    }
}
