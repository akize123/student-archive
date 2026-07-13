package com.auca.archive.service;

import com.auca.archive.config.AucaFacultyCatalog;
import com.auca.archive.domain.ExamPaperType;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.dto.UploadDocumentRequest;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.model.StudentEntity;
import com.auca.archive.repository.FolderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Path;
import java.util.Locale;
import java.util.Optional;

@Service
public class ArchiveTreeService {
    public static final String ROOT_CODE = "AUCA";
    public static final String OFFICIAL_DOCUMENTS_NAME = "Official Documents";
    public static final String OFFICIAL_DOCUMENTS_SUFFIX = "SOFF";
    public static final String FINAL_YEAR_PROJECT_NAME = "Final Year Project";
    public static final String FINAL_YEAR_PROJECT_SUFFIX = "SMY";
    public static final String ARCHIVE_PROJECT_NAME = "Archive project";
    public static final String ARCHIVE_PROJECT_SUFFIX = "SARC";
    public static final String LIBRARY_REVIEW_NAME = "Library FYP Reviews";
    public static final String LIBRARY_REVIEW_CODE = "LIB-FYP";
    public static final String LIBRARY_ACCEPTED_NAME = "Accepted";
    public static final String LIBRARY_ACCEPTED_CODE = "LIB-FYP-ACC";
    public static final String LIBRARY_REJECTED_NAME = "Rejected";
    public static final String LIBRARY_REJECTED_CODE = "LIB-FYP-REJ";
    /** @deprecated use FINAL_YEAR_PROJECT_NAME */
    public static final String MY_PROJECTS_NAME = FINAL_YEAR_PROJECT_NAME;
    /** @deprecated use FINAL_YEAR_PROJECT_SUFFIX */
    public static final String MY_PROJECTS_SUFFIX = FINAL_YEAR_PROJECT_SUFFIX;

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

    @Transactional
    public StudentWorkspace ensureStudentWorkspace(StudentEntity student) {
        return ensureStudentWorkspace(student, null, null, null, null);
    }

    @Transactional
    public StudentWorkspace ensureStudentWorkspace(
            StudentEntity student,
            String facultyOverride,
            String departmentOverride,
            String academicYearOverride,
            String semesterOverride
    ) {
        if (student == null || student.getStudentNumber() == null || student.getStudentNumber().isBlank()) {
            throw new IllegalArgumentException("Student profile is required to create the workspace");
        }
        String faculty = requireText(student.getFaculty(), facultyOverride, "Faculty is required to create the student workspace");
        String department = requireText(student.getDepartment(), departmentOverride, "Department is required to create the student workspace");
        FolderEntity studentFolder = resolveStudentRootFolder(
                student.getStudentNumber(),
                faculty,
                department,
                academicYearOverride,
                semesterOverride
        );
        FolderEntity official = folderService.resolveOrCreateFolder(
                OFFICIAL_DOCUMENTS_NAME,
                studentFolder.getCode() + "-" + OFFICIAL_DOCUMENTS_SUFFIX,
                studentFolder.getId()
        );
        FolderEntity projects = folderService.resolveOrCreateFolder(
                FINAL_YEAR_PROJECT_NAME,
                studentFolder.getCode() + "-" + FINAL_YEAR_PROJECT_SUFFIX,
                studentFolder.getId()
        );
        FolderEntity archiveProject = folderService.resolveOrCreateFolder(
                ARCHIVE_PROJECT_NAME,
                studentFolder.getCode() + "-" + ARCHIVE_PROJECT_SUFFIX,
                studentFolder.getId()
        );
        return new StudentWorkspace(studentFolder, official, projects, archiveProject);
    }

    @Transactional
    public LibrarianReviewFolders ensureLibrarianReviewFolders() {
        FolderEntity root = folderService.getFolderByCodeOrThrow(ROOT_CODE);
        FolderEntity libraryRoot = folderService.resolveOrCreateFolder(
                LIBRARY_REVIEW_NAME,
                LIBRARY_REVIEW_CODE,
                root.getId()
        );
        FolderEntity accepted = folderService.resolveOrCreateFolder(
                LIBRARY_ACCEPTED_NAME,
                LIBRARY_ACCEPTED_CODE,
                libraryRoot.getId()
        );
        FolderEntity rejected = folderService.resolveOrCreateFolder(
                LIBRARY_REJECTED_NAME,
                LIBRARY_REJECTED_CODE,
                libraryRoot.getId()
        );
        return new LibrarianReviewFolders(libraryRoot, accepted, rejected);
    }

    @Transactional
    public FolderEntity createAcceptedProjectProfile(StudentEntity student, String projectTitle, Long documentId) {
        StudentWorkspace workspace = ensureStudentWorkspace(student);
        String safeTitle = projectTitle == null || projectTitle.isBlank() ? "Accepted Project" : projectTitle.trim();
        String profileCode = workspace.archiveProject().getCode()
                + "-PRF-"
                + sanitizeCode(safeTitle)
                + "-"
                + (documentId == null ? "NEW" : documentId);
        return folderService.resolveOrCreateFolder(safeTitle, profileCode, workspace.archiveProject().getId());
    }

    @Transactional
    public FolderEntity placeRejectedProject(StudentEntity student, String projectTitle, Long documentId) {
        LibrarianReviewFolders reviewFolders = ensureLibrarianReviewFolders();
        String label = (student.getStudentNumber() == null ? "Student" : student.getStudentNumber())
                + " - "
                + (projectTitle == null || projectTitle.isBlank() ? "Rejected Project" : projectTitle.trim());
        String code = reviewFolders.rejected().getCode()
                + "-STU-"
                + sanitizeCode(student.getStudentNumber())
                + "-"
                + (documentId == null ? "NEW" : documentId);
        return folderService.resolveOrCreateFolder(label, code, reviewFolders.rejected().getId());
    }

    @Transactional
    public FolderEntity placeAcceptedProjectForLibrarian(StudentEntity student, String projectTitle, Long documentId) {
        LibrarianReviewFolders reviewFolders = ensureLibrarianReviewFolders();
        String label = (student.getStudentNumber() == null ? "Student" : student.getStudentNumber())
                + " - "
                + (projectTitle == null || projectTitle.isBlank() ? "Accepted Project" : projectTitle.trim());
        String code = reviewFolders.accepted().getCode()
                + "-STU-"
                + sanitizeCode(student.getStudentNumber())
                + "-"
                + (documentId == null ? "NEW" : documentId);
        return folderService.resolveOrCreateFolder(label, code, reviewFolders.accepted().getId());
    }

    public FolderEntity resolveUploadFolder(
            UploadDocumentRequest request,
            StudentEntity student,
            ExamPaperType examPaperType
    ) {
        StudentWorkspace workspace = ensureStudentWorkspace(
                student,
                request.faculty(),
                request.department(),
                request.academicYear(),
                request.semester()
        );

        StudentDocumentCategory category = request.category();
        FolderEntity bucket = isOfficialCategory(category) ? workspace.officialDocuments() : workspace.myProjects();

        if (category != StudentDocumentCategory.EXAMINATION_DOCUMENTS || examPaperType == null) {
            return bucket;
        }

        FolderEntity typeFolder = folderService.resolveOrCreateFolder(
                examPaperType.getDisplayName(),
                bucket.getCode() + "-" + examPaperType.getFolderCode(),
                bucket.getId()
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

        String bucket = isOfficialCategory(request.category())
                ? OFFICIAL_DOCUMENTS_SUFFIX
                : FINAL_YEAR_PROJECT_SUFFIX;

        Path studentRoot = storageRoot
                .resolve(sanitizePath(faculty))
                .resolve(sanitizePath(department))
                .resolve(sanitizePath(term.academicYear()))
                .resolve(sanitizePath(term.semesterFolderName()))
                .resolve(sanitizePath(studentNumber))
                .resolve(sanitizePath(bucket));

        if (request.category() != StudentDocumentCategory.EXAMINATION_DOCUMENTS || examPaperType == null) {
            return studentRoot;
        }

        return studentRoot
                .resolve(sanitizePath(examPaperType.getFolderCode()))
                .resolve(sanitizePath(request.course()));
    }

    public static boolean isStudentDefaultFolderCode(String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        String normalized = code.toUpperCase(Locale.ROOT);
        return normalized.endsWith("-" + OFFICIAL_DOCUMENTS_SUFFIX)
                || normalized.endsWith("-" + FINAL_YEAR_PROJECT_SUFFIX)
                || normalized.endsWith("-" + ARCHIVE_PROJECT_SUFFIX);
    }

    public static boolean isWithinStudentDefaultWorkspace(String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        String normalized = code.toUpperCase(Locale.ROOT);
        return normalized.contains("-" + OFFICIAL_DOCUMENTS_SUFFIX)
                || normalized.contains("-" + FINAL_YEAR_PROJECT_SUFFIX)
                || normalized.contains("-" + ARCHIVE_PROJECT_SUFFIX);
    }

    public static boolean isLibrarianRejectedFolderCode(String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        return code.toUpperCase(Locale.ROOT).contains(LIBRARY_REJECTED_CODE);
    }

    public static boolean isLibrarianAcceptedFolderCode(String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        return code.toUpperCase(Locale.ROOT).contains(LIBRARY_ACCEPTED_CODE);
    }

    public static boolean isLibrarianReviewFolderCode(String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        return code.toUpperCase(Locale.ROOT).startsWith(LIBRARY_REVIEW_CODE);
    }

    private FolderEntity resolveStudentRootFolder(
            String studentNumber,
            String faculty,
            String department,
            String academicYearOverride,
            String semesterOverride
    ) {
        FolderEntity root = folderService.getFolderByCodeOrThrow(ROOT_CODE);
        FolderEntity facultyFolder = resolveFacultyFolder(faculty, root.getId());
        FolderEntity departmentFolder = resolveDepartmentFolder(facultyFolder, department);

        AcademicTermService.ResolvedTerm term = academicTermService.resolveTerm(
                studentNumber,
                academicYearOverride,
                semesterOverride
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
        return folderService.resolveOrCreateFolder(studentNumber, studentCode, semesterFolder.getId());
    }

    private boolean isOfficialCategory(StudentDocumentCategory category) {
        return category == StudentDocumentCategory.REGISTRATION_FORM
                || category == StudentDocumentCategory.REINTEGRATION_FORM
                || category == StudentDocumentCategory.APPLICATION_DOCUMENTS
                || category == StudentDocumentCategory.EXAMINATION_DOCUMENTS;
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

    public record StudentWorkspace(
            FolderEntity studentRoot,
            FolderEntity officialDocuments,
            FolderEntity myProjects,
            FolderEntity archiveProject
    ) {
    }

    public record LibrarianReviewFolders(
            FolderEntity libraryRoot,
            FolderEntity accepted,
            FolderEntity rejected
    ) {
    }
}
