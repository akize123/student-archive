package com.auca.archive.service;

import com.auca.archive.config.AucaFacultyCatalog;
import com.auca.archive.domain.ExamPaperType;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.UploadDocumentRequest;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.model.StudentEntity;
import com.auca.archive.repository.FolderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Path;
import java.util.HashSet;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
public class ArchiveTreeService {
    public static final String ROOT_CODE = "AUCA";
    public static final String OFFICIAL_DOCUMENTS_NAME = "Official Documents";
    public static final String OFFICIAL_DOCUMENTS_SUFFIX = "SOFF";
    public static final String FINAL_YEAR_PROJECT_NAME = "Final Year Project";
    public static final String FINAL_YEAR_PROJECT_SUFFIX = "SMY";
    public static final String MY_PROJECTS_PENDING_NAME = "Pending";
    public static final String MY_PROJECTS_PENDING_SUFFIX = "SMY-PND";
    public static final String MY_PROJECTS_REJECTED_NAME = "Rejected";
    public static final String MY_PROJECTS_REJECTED_SUFFIX = "SMY-REJ";
    public static final String ARCHIVE_PROJECT_NAME = "Archive project";
    public static final String ARCHIVE_PROJECT_SUFFIX = "SARC";
    public static final String FYP_PUBLISHED_NAME = "FYP Published Archive";
    public static final String FYP_PUBLISHED_SUFFIX = "FYP-PUB";
    public static final String FYP_PUBLISHED_ACCEPTED_NAME = "Accepted";
    public static final String FYP_PUBLISHED_ACCEPTED_SUFFIX = "FYP-PUB-ACC";
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
        return ensureStudentWorkspace(student, null, null, null, null, true);
    }

    @Transactional
    public StudentWorkspace ensureStudentWorkspace(
            StudentEntity student,
            String facultyOverride,
            String departmentOverride,
            String academicYearOverride,
            String semesterOverride
    ) {
        return ensureStudentWorkspace(
                student,
                facultyOverride,
                departmentOverride,
                academicYearOverride,
                semesterOverride,
                true
        );
    }

    @Transactional
    public StudentWorkspace ensureStudentWorkspace(
            StudentEntity student,
            String facultyOverride,
            String departmentOverride,
            String academicYearOverride,
            String semesterOverride,
            boolean createDefaultBuckets
    ) {
        if (student == null || student.getStudentNumber() == null || student.getStudentNumber().isBlank()) {
            throw new IllegalArgumentException("Student profile is required to create the workspace");
        }
        String faculty = preferOverride(facultyOverride, student.getFaculty(), "Faculty is required to create the student workspace");
        String department = preferOverride(departmentOverride, student.getDepartment(), "Department is required to create the student workspace");
        FolderEntity studentFolder = resolveStudentRootFolder(
                student.getStudentNumber(),
                faculty,
                department,
                academicYearOverride,
                semesterOverride
        );
        if (!createDefaultBuckets) {
            return new StudentWorkspace(studentFolder, studentFolder, studentFolder, studentFolder, studentFolder, studentFolder);
        }
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
        FolderEntity pending = folderService.resolveOrCreateFolder(
                MY_PROJECTS_PENDING_NAME,
                projects.getCode() + "-" + MY_PROJECTS_PENDING_SUFFIX,
                projects.getId()
        );
        FolderEntity rejected = folderService.resolveOrCreateFolder(
                MY_PROJECTS_REJECTED_NAME,
                projects.getCode() + "-" + MY_PROJECTS_REJECTED_SUFFIX,
                projects.getId()
        );
        FolderEntity archiveProject = folderService.resolveOrCreateFolder(
                ARCHIVE_PROJECT_NAME,
                studentFolder.getCode() + "-" + ARCHIVE_PROJECT_SUFFIX,
                studentFolder.getId()
        );
        return new StudentWorkspace(studentFolder, official, projects, pending, rejected, archiveProject);
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
    public FolderEntity placeRejectedProjectForStudent(StudentEntity student, String projectTitle, Long documentId) {
        StudentWorkspace workspace = ensureStudentWorkspace(student);
        String safeTitle = projectTitle == null || projectTitle.isBlank() ? "Rejected Project" : projectTitle.trim();
        String label = safeTitle;
        String code = workspace.myProjectsRejected().getCode()
                + "-DOC-"
                + (documentId == null ? "NEW" : documentId);
        return folderService.resolveOrCreateFolder(label, code, workspace.myProjectsRejected().getId());
    }

    @Transactional
    public FolderEntity placePublishedProject(StudentEntity student, String projectTitle, Long documentId) {
        FolderEntity semesterFolder = resolveSemesterFolderForStudent(student);
        FolderEntity acceptedRoot = ensureSemesterPublishedArchive(semesterFolder);
        String label = (student.getStudentNumber() == null ? "Student" : student.getStudentNumber())
                + " - "
                + (projectTitle == null || projectTitle.isBlank() ? "Accepted Project" : projectTitle.trim());
        String code = acceptedRoot.getCode()
                + "-STU-"
                + sanitizeCode(student.getStudentNumber())
                + "-"
                + (documentId == null ? "NEW" : documentId);
        return folderService.resolveOrCreateFolder(label, code, acceptedRoot.getId());
    }

    @Transactional
    public FolderEntity ensureSemesterPublishedArchive(FolderEntity semesterFolder) {
        String publishedCode = semesterFolder.getCode() + "-" + FYP_PUBLISHED_SUFFIX;
        FolderEntity publishedRoot = folderService.resolveOrCreateFolder(
                FYP_PUBLISHED_NAME,
                publishedCode,
                semesterFolder.getId()
        );
        return folderService.resolveOrCreateFolder(
                FYP_PUBLISHED_ACCEPTED_NAME,
                publishedCode + "-ACC",
                publishedRoot.getId()
        );
    }

    public FolderEntity resolveSemesterFolderForStudent(StudentEntity student) {
        StudentWorkspace workspace = ensureStudentWorkspace(student);
        Long semesterId = workspace.studentRoot().getParentId();
        if (semesterId == null) {
            throw new IllegalArgumentException("Student workspace is missing semester placement");
        }
        return folderRepository.findById(semesterId)
                .orElseThrow(() -> new IllegalArgumentException("Semester folder not found for student workspace"));
    }

    public static boolean isPublishedArchiveFolderCode(String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        return code.toUpperCase(Locale.ROOT).contains("-" + FYP_PUBLISHED_SUFFIX);
    }

    public static Long parseLinkedDocumentIdFromFolderCode(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        String normalized = code.trim();
        int lastDash = normalized.lastIndexOf('-');
        if (lastDash < 0 || lastDash >= normalized.length() - 1) {
            return null;
        }
        try {
            return Long.parseLong(normalized.substring(lastDash + 1));
        } catch (NumberFormatException ex) {
            return null;
        }
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
            ExamPaperType examPaperType,
            UserRole role,
            String documentTypeName
    ) {
        return resolveUploadFolder(request, student, examPaperType, role, documentTypeName, documentTypeName);
    }

    public FolderEntity resolveUploadFolder(
            UploadDocumentRequest request,
            StudentEntity student,
            ExamPaperType examPaperType,
            UserRole role,
            String categoryName,
            String documentTypeName
    ) {
        boolean staffPlacementUpload = role != null && role != UserRole.STUDENT;
        StudentUploadPlacement placement = resolveStaffUploadPlacement(student, request, role);
        StudentWorkspace workspace = ensureStudentWorkspace(
                student,
                placement.faculty(),
                placement.department(),
                placement.academicYear(),
                placement.semester(),
                !staffPlacementUpload
        );

        if (role == UserRole.STUDENT && request.category() == StudentDocumentCategory.FINAL_YEAR_PROJECT) {
            return workspace.myProjectsPending();
        }

        return ensureStudentDocumentPath(
                workspace.studentRoot(),
                request.academicYear(),
                request.semester(),
                categoryName,
                documentTypeName
        );
    }

    public FolderEntity resolveUploadFolder(
            UploadDocumentRequest request,
            StudentEntity student,
            ExamPaperType examPaperType,
            UserRole role
    ) {
        return resolveUploadFolder(
                request,
                student,
                examPaperType,
                role,
                request.category().getDisplayName(),
                request.category().getDisplayName()
        );
    }

    /**
     * Legacy overload: category and type share the same label.
     */
    @Transactional
    public FolderEntity ensureStudentDocumentPath(
            FolderEntity studentRoot,
            String academicYear,
            String semester,
            String documentTypeName
    ) {
        return ensureStudentDocumentPath(studentRoot, academicYear, semester, documentTypeName, documentTypeName);
    }

    /**
     * Inside student folder only:
     * {@code {DocAY}/{DocSem}/{Category}/{SubType}/}
     * Document year/semester arrange files under the student ID — they do not move the student folder.
     */
    @Transactional
    public FolderEntity ensureStudentDocumentPath(
            FolderEntity studentRoot,
            String documentAcademicYear,
            String documentSemester,
            String categoryName,
            String documentTypeName
    ) {
        FolderEntity parent = studentRoot;
        AcademicTermService.ResolvedTerm term = null;
        try {
            if ((documentAcademicYear != null && !documentAcademicYear.isBlank())
                    || (documentSemester != null && !documentSemester.isBlank())) {
                term = academicTermService.resolveTerm(
                        studentRoot.getName(),
                        documentAcademicYear,
                        documentSemester
                );
            }
        } catch (IllegalArgumentException ignored) {
            term = null;
        }

        if (term != null) {
            String yearLabel = term.academicYear();
            String semesterLabel = term.semesterFolderName();
            FolderEntity yearFolder = folderService.resolveOrCreateFolder(
                    yearLabel,
                    studentRoot.getCode() + "-INAY-" + sanitizeCode(yearLabel),
                    studentRoot.getId()
            );
            parent = folderService.resolveOrCreateFolder(
                    semesterLabel,
                    yearFolder.getCode() + "-INSEM-" + sanitizeCode(semesterLabel),
                    yearFolder.getId()
            );
        }

        String categoryLabel = firstNonBlank(categoryName, documentTypeName, "Documents");
        String typeLabel = firstNonBlank(documentTypeName, categoryLabel);

        FolderEntity categoryFolder = folderService.resolveOrCreateFolder(
                categoryLabel,
                parent.getCode() + "-CAT-" + sanitizeCode(categoryLabel),
                parent.getId()
        );
        if (categoryLabel.equalsIgnoreCase(typeLabel)) {
            return categoryFolder;
        }
        return folderService.resolveOrCreateFolder(
                typeLabel,
                categoryFolder.getCode() + "-TYP-" + sanitizeCode(typeLabel),
                categoryFolder.getId()
        );
    }

    public FolderEntity resolveUploadFolder(
            UploadDocumentRequest request,
            StudentEntity student,
            ExamPaperType examPaperType
    ) {
        return resolveUploadFolder(request, student, examPaperType, null);
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
            ExamPaperType examPaperType,
            UserRole role,
            String documentTypeName
    ) {
        StudentUploadPlacement placement = resolveStaffUploadPlacement(student, request, role);
        String faculty = preferOverride(placement.faculty(), student.getFaculty(), "Faculty is required");
        String department = preferOverride(placement.department(), student.getDepartment(), "Department is required");
        String studentNumber = student.getStudentNumber();

        AcademicTermService.ResolvedTerm outerTerm = academicTermService.resolveTerm(
                studentNumber,
                placement.academicYear(),
                placement.semester()
        );

        Path studentBase = storageRoot
                .resolve(sanitizePath(faculty))
                .resolve(sanitizePath(department))
                .resolve(sanitizePath(outerTerm.academicYear()))
                .resolve(sanitizePath(outerTerm.semesterFolderName()))
                .resolve(sanitizePath(studentNumber));

        if (role == UserRole.STUDENT && request.category() == StudentDocumentCategory.FINAL_YEAR_PROJECT) {
            return studentBase.resolve(sanitizePath(FINAL_YEAR_PROJECT_SUFFIX));
        }

        return appendDocumentInnerPath(
                studentBase,
                request.academicYear(),
                request.semester(),
                studentNumber,
                request.category() == null ? null : request.category().getDisplayName(),
                documentTypeName
        );
    }

    public Path resolveStoragePath(
            Path storageRoot,
            UploadDocumentRequest request,
            StudentEntity student,
            ExamPaperType examPaperType,
            UserRole role,
            String categoryName,
            String documentTypeName
    ) {
        StudentUploadPlacement placement = resolveStaffUploadPlacement(student, request, role);
        String faculty = preferOverride(placement.faculty(), student.getFaculty(), "Faculty is required");
        String department = preferOverride(placement.department(), student.getDepartment(), "Department is required");
        String studentNumber = student.getStudentNumber();

        AcademicTermService.ResolvedTerm outerTerm = academicTermService.resolveTerm(
                studentNumber,
                placement.academicYear(),
                placement.semester()
        );

        Path studentBase = storageRoot
                .resolve(sanitizePath(faculty))
                .resolve(sanitizePath(department))
                .resolve(sanitizePath(outerTerm.academicYear()))
                .resolve(sanitizePath(outerTerm.semesterFolderName()))
                .resolve(sanitizePath(studentNumber));

        if (role == UserRole.STUDENT && request.category() == StudentDocumentCategory.FINAL_YEAR_PROJECT) {
            return studentBase.resolve(sanitizePath(FINAL_YEAR_PROJECT_SUFFIX));
        }

        return appendDocumentInnerPath(
                studentBase,
                request.academicYear(),
                request.semester(),
                studentNumber,
                categoryName,
                documentTypeName
        );
    }

    public Path resolveStoragePath(
            Path storageRoot,
            UploadDocumentRequest request,
            StudentEntity student,
            ExamPaperType examPaperType,
            UserRole role
    ) {
        String label = request.category().getDisplayName();
        return resolveStoragePath(storageRoot, request, student, examPaperType, role, label, label);
    }

    public Path resolveImportStoragePath(
            Path storageRoot,
            StudentEntity student,
            String faculty,
            String department,
            String academicYear,
            String semester,
            String documentTypeName
    ) {
        return resolveImportStoragePath(
                storageRoot,
                student,
                faculty,
                department,
                academicYear,
                semester,
                documentTypeName,
                documentTypeName
        );
    }

    public Path resolveImportStoragePath(
            Path storageRoot,
            StudentEntity student,
            String faculty,
            String department,
            String academicYear,
            String semester,
            String categoryName,
            String documentTypeName
    ) {
        String studentNumber = student.getStudentNumber();
        AcademicTermService.ResolvedTerm term = academicTermService.resolveTerm(studentNumber, academicYear, semester);
        Path studentBase = storageRoot
                .resolve(sanitizePath(faculty))
                .resolve(sanitizePath(department))
                .resolve(sanitizePath(term.academicYear()))
                .resolve(sanitizePath(term.semesterFolderName()))
                .resolve(sanitizePath(studentNumber));
        return appendDocumentInnerPath(
                studentBase,
                academicYear,
                semester,
                studentNumber,
                categoryName,
                documentTypeName
        );
    }

    /**
     * Under student ID only: {@code {DocAY}/{DocSem}/{Category}/{SubType}/}.
     */
    private Path appendDocumentInnerPath(
            Path studentBase,
            String documentAcademicYear,
            String documentSemester,
            String studentNumber,
            String categoryName,
            String documentTypeName
    ) {
        Path parent = studentBase;
        if ((documentAcademicYear != null && !documentAcademicYear.isBlank())
                || (documentSemester != null && !documentSemester.isBlank())) {
            try {
                AcademicTermService.ResolvedTerm innerTerm = academicTermService.resolveTerm(
                        studentNumber,
                        documentAcademicYear,
                        documentSemester
                );
                parent = studentBase
                        .resolve(sanitizePath(innerTerm.academicYear()))
                        .resolve(sanitizePath(innerTerm.semesterFolderName()));
            } catch (IllegalArgumentException ignored) {
                parent = studentBase;
            }
        }
        return appendCategoryTypePath(parent, categoryName, documentTypeName);
    }

    private Path appendCategoryTypePath(Path studentBase, String categoryName, String documentTypeName) {
        String categoryLabel = firstNonBlank(categoryName, documentTypeName, "Documents");
        String typeLabel = firstNonBlank(documentTypeName, categoryLabel);
        Path categoryPath = studentBase.resolve(sanitizePath(categoryLabel));
        if (categoryLabel.equalsIgnoreCase(typeLabel)) {
            return categoryPath;
        }
        return categoryPath.resolve(sanitizePath(typeLabel));
    }

    public StudentUploadPlacement resolveStudentUploadPlacement(StudentEntity student) {
        if (student == null) {
            return StudentUploadPlacement.empty();
        }
        Optional<StudentUploadPlacement> fromFolder = findStudentFolderId(student)
                .flatMap(folderRepository::findById)
                .map(this::parseUploadPlacementFromFolder);
        if (fromFolder.isPresent()) {
            return fromFolder.get();
        }
        return new StudentUploadPlacement(
                trim(student.getFaculty()),
                trim(student.getDepartment()),
                null,
                null
        );
    }

    private StudentUploadPlacement resolveStaffUploadPlacement(
            StudentEntity student,
            UploadDocumentRequest request,
            UserRole role
    ) {
        if (role == null || role == UserRole.STUDENT) {
            return new StudentUploadPlacement(
                    preferOverride(request.faculty(), student.getFaculty(), null),
                    preferOverride(request.department(), student.getDepartment(), null),
                    request.academicYear(),
                    request.semester()
            );
        }

        // Prefer the student's existing archive folder so document year/semester never move the student.
        StudentUploadPlacement existing = resolveStudentUploadPlacement(student);
        if (existing.hasArchiveLocation()) {
            return existing;
        }

        // New student: outer Faculty/Dept/Year/Sem come from browse placement only.
        String outerYear = trim(request.placementAcademicYear());
        String outerSemester = trim(request.placementSemester());
        if (outerYear == null || outerSemester == null) {
            throw new IllegalArgumentException(
                    "Open a semester folder to upload. Document year and semester only arrange files inside the student folder."
            );
        }

        return new StudentUploadPlacement(
                preferOverride(request.faculty(), student.getFaculty(), null),
                preferOverride(request.department(), student.getDepartment(), null),
                outerYear,
                outerSemester
        );
    }

    private StudentUploadPlacement parseUploadPlacementFromFolder(FolderEntity studentFolder) {
        String faculty = "";
        String department = "";
        String academicYear = "";
        String semester = "";
        FolderEntity current = studentFolder;
        Set<Long> visited = new HashSet<>();
        while (current != null && visited.add(current.getId())) {
            String code = current.getCode() == null ? "" : current.getCode().toUpperCase(Locale.ROOT);
            String name = current.getName() == null ? "" : current.getName().trim();
            if (code.matches("^FAC-[A-Z0-9]+$")) {
                faculty = name;
            }
            if (code.matches("^FAC-[A-Z0-9]+-DEPT-[A-Z0-9]+$")) {
                department = name;
            }
            if (code.matches(".*-AY-\\d{8}$") || name.matches("^\\d{4}-\\d{4}$")) {
                academicYear = name;
            }
            if ((code.contains("-SEM-") && !code.contains("-STU-")) || name.matches("^\\d{4}/\\d$")) {
                semester = name;
            }
            if (current.getParentId() == null) {
                break;
            }
            current = folderRepository.findById(current.getParentId()).orElse(null);
        }
        return new StudentUploadPlacement(faculty, department, academicYear, semester);
    }

    public Path resolveStoragePath(
            Path storageRoot,
            UploadDocumentRequest request,
            StudentEntity student,
            ExamPaperType examPaperType
    ) {
        return resolveStoragePath(storageRoot, request, student, examPaperType, null);
    }

    public static boolean isSemesterStudentRootFolder(String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        String normalized = code.toUpperCase(Locale.ROOT);
        return normalized.contains("-STU-") && !isStudentDefaultFolderCode(normalized);
    }

    public static boolean isStudentDefaultFolderCode(String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        String normalized = code.toUpperCase(Locale.ROOT);
        return normalized.endsWith("-" + OFFICIAL_DOCUMENTS_SUFFIX)
                || normalized.endsWith("-" + FINAL_YEAR_PROJECT_SUFFIX)
                || normalized.endsWith("-" + ARCHIVE_PROJECT_SUFFIX)
                || normalized.endsWith("-" + MY_PROJECTS_PENDING_SUFFIX)
                || normalized.endsWith("-" + MY_PROJECTS_REJECTED_SUFFIX);
    }

    public static boolean isMyProjectsPendingFolderCode(String code) {
        return code != null && code.toUpperCase(Locale.ROOT).endsWith("-" + MY_PROJECTS_PENDING_SUFFIX);
    }

    public static boolean isMyProjectsRejectedFolderCode(String code) {
        return code != null && code.toUpperCase(Locale.ROOT).endsWith("-" + MY_PROJECTS_REJECTED_SUFFIX);
    }

    public static boolean isWithinStudentDefaultWorkspace(String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        String normalized = code.toUpperCase(Locale.ROOT);
        return normalized.contains("-" + OFFICIAL_DOCUMENTS_SUFFIX)
                || normalized.contains("-" + FINAL_YEAR_PROJECT_SUFFIX)
                || normalized.contains("-" + MY_PROJECTS_PENDING_SUFFIX)
                || normalized.contains("-" + MY_PROJECTS_REJECTED_SUFFIX)
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

    private String preferOverride(String overrideValue, String studentValue, String message) {
        String override = trim(overrideValue);
        if (override != null) {
            return override;
        }
        return requireText(studentValue, null, message);
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

    private String firstNonBlank(String primary, String fallback) {
        String value = trim(primary);
        if (value != null) {
            return value;
        }
        return trim(fallback);
    }

    private String firstNonBlank(String primary, String secondary, String tertiary) {
        String value = firstNonBlank(primary, secondary);
        if (value != null) {
            return value;
        }
        String last = trim(tertiary);
        return last == null ? "Documents" : last;
    }

    public record StudentWorkspace(
            FolderEntity studentRoot,
            FolderEntity officialDocuments,
            FolderEntity myProjects,
            FolderEntity myProjectsPending,
            FolderEntity myProjectsRejected,
            FolderEntity archiveProject
    ) {
    }

    public record LibrarianReviewFolders(
            FolderEntity libraryRoot,
            FolderEntity accepted,
            FolderEntity rejected
    ) {
    }

    public record StudentUploadPlacement(
            String faculty,
            String department,
            String academicYear,
            String semester
    ) {
        public static StudentUploadPlacement empty() {
            return new StudentUploadPlacement(null, null, null, null);
        }

        public boolean hasArchiveLocation() {
            return faculty != null && !faculty.isBlank()
                    && department != null && !department.isBlank()
                    && academicYear != null && !academicYear.isBlank()
                    && semester != null && !semester.isBlank();
        }
    }
}
