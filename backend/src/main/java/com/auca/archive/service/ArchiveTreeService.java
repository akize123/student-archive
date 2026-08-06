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
import java.util.Objects;
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
        return ensureStudentWorkspace(student, null, null, null, null, true, null);
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
                true,
                null
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
        return ensureStudentWorkspace(
                student,
                facultyOverride,
                departmentOverride,
                academicYearOverride,
                semesterOverride,
                createDefaultBuckets,
                null
        );
    }

    @Transactional
    public StudentWorkspace ensureStudentWorkspace(
            StudentEntity student,
            String facultyOverride,
            String departmentOverride,
            String academicYearOverride,
            String semesterOverride,
            boolean createDefaultBuckets,
            UserRole structureOwnerRole
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
                semesterOverride,
                structureOwnerRole
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
                !staffPlacementUpload,
                staffPlacementUpload ? role : null
        );

        if (role == UserRole.STUDENT && request.category() == StudentDocumentCategory.FINAL_YEAR_PROJECT) {
            return workspace.myProjectsPending();
        }

        // Staff semester uploads are placed into document-type subfolders by DocumentService.
        if (staffPlacementUpload) {
            return workspace.studentRoot();
        }

        return ensureStudentDocumentPath(
                role == UserRole.STUDENT ? workspace.officialDocuments() : workspace.studentRoot(),
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
     * {@code {DocAY}/{DocSem}/{DocumentType}/{SubType?}/}
     * Document year/semester and document type arrange files under the student ID —
     * they do not move the student folder.
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

        if (role != null && role != UserRole.STUDENT) {
            return studentBase;
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

        if (role != null && role != UserRole.STUDENT) {
            String documentAcademicYear = trim(request.academicYear());
            String documentSemester = trim(request.semester());
            if (documentAcademicYear != null && documentSemester != null) {
                return appendDocumentInnerPath(
                        studentBase,
                        documentAcademicYear,
                        documentSemester,
                        studentNumber,
                        categoryName,
                        documentTypeName
                );
            }
            return studentBase;
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
            String placementAcademicYear,
            String placementSemester,
            String documentAcademicYear,
            String documentSemester,
            String categoryName,
            String documentTypeName
    ) {
        String studentNumber = student.getStudentNumber();
        AcademicTermService.ResolvedTerm term = academicTermService.resolveTerm(
                studentNumber,
                placementAcademicYear,
                placementSemester
        );
        Path studentBase = storageRoot
                .resolve(sanitizePath(faculty))
                .resolve(sanitizePath(department))
                .resolve(sanitizePath(term.academicYear()))
                .resolve(sanitizePath(term.semesterFolderName()))
                .resolve(sanitizePath(studentNumber));
        String innerYear = trim(documentAcademicYear);
        String innerSemester = trim(documentSemester);
        if (innerYear != null && innerSemester != null) {
            return appendDocumentInnerPath(
                    studentBase,
                    innerYear,
                    innerSemester,
                    studentNumber,
                    categoryName,
                    documentTypeName
            );
        }
        // Import / flat office layout: Year/Sem/Student/Type[/Sub]
        return appendCategoryTypePath(studentBase, categoryName, documentTypeName);
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
        return resolveImportStoragePath(
                storageRoot,
                student,
                faculty,
                department,
                academicYear,
                semester,
                null,
                null,
                categoryName,
                documentTypeName
        );
    }

    /**
     * Under student ID only: {@code {DocAY}/{DocSem}/{DocumentType}/{SubType?}/}.
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

        // Prefer the open semester (browse placement) so staff uploads create/use the student
        // ID folder under the semester they are viewing.
        String outerYear = firstNonBlank(trim(request.placementAcademicYear()), trim(request.academicYear()));
        String outerSemester = firstNonBlank(trim(request.placementSemester()), trim(request.semester()));
        if (outerYear != null && outerSemester != null) {
            return new StudentUploadPlacement(
                    preferOverride(request.faculty(), student.getFaculty(), null),
                    preferOverride(request.department(), student.getDepartment(), null),
                    outerYear,
                    outerSemester
            );
        }

        // Fallback for older clients: reuse the student's existing archive location.
        StudentUploadPlacement existing = resolveStudentUploadPlacement(student);
        if (existing.hasArchiveLocation()) {
            return existing;
        }

        throw new IllegalArgumentException(
                "Open a semester folder to upload. Enter a Student ID — if that student folder does not exist under the semester, it will be created automatically."
        );
    }

    public StudentUploadPlacement resolveUploadPlacementFromFolder(FolderEntity folder) {
        return parseUploadPlacementFromFolder(folder);
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
            if (code.matches(".*-AY-\\d{8}(-[A-Z]+)?$") || name.matches("^\\d{4}-\\d{4}$")) {
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
        return normalized.contains("-STU-")
                && !normalized.contains("-FLD-")
                && !isStudentDefaultFolderCode(normalized);
    }

    /**
     * Registrar uploads use document-type subfolders (FLD) under the semester student root
     * so files appear in the archive tree instead of being hidden at the student ID level.
     * Reuses an existing child with the same name when present (any code).
     */
    @Transactional
    public FolderEntity ensureRegistrarDocumentSubfolder(FolderEntity folder, String subfolderName) {
        if (folder == null || subfolderName == null || subfolderName.isBlank()) {
            return folder;
        }
        if (!isSemesterStudentRootFolder(folder.getCode())) {
            return folder;
        }
        String trimmedName = subfolderName.trim();
        Optional<FolderEntity> existing = findChildFolderByName(folder.getId(), trimmedName);
        if (existing.isPresent()) {
            return existing.get();
        }
        String code = folder.getCode() + "-FLD-" + sanitizeCode(trimmedName);
        return folderService.resolveOrCreateFolder(trimmedName, code, folder.getId());
    }

    /**
     * Import path matching the office archive tree:
     * {@code Year → Semester → Student → Document type → Subcategory?}.
     * Reuses existing document-type folders under the student (e.g. Transcript Request).
     */
    @Transactional
    public FolderEntity ensureImportDocumentTypePath(
            FolderEntity studentRoot,
            String primaryDocumentType,
            String documentTypeOrSubtype
    ) {
        if (studentRoot == null) {
            throw new IllegalArgumentException("Student folder is required for import.");
        }
        FolderEntity root = studentRoot;
        if (!isSemesterStudentRootFolder(root.getCode())) {
            root = folderService.resolveSemesterStudentRootFolder(studentRoot)
                    .orElseThrow(() -> new IllegalArgumentException("Could not resolve the student folder for import."));
        }
        String primary = firstNonBlank(primaryDocumentType, documentTypeOrSubtype, "Documents");
        String leaf = firstNonBlank(documentTypeOrSubtype, primary);

        FolderEntity typeFolder = ensureNamedDocumentSubfolder(root, primary);
        if (primary.equalsIgnoreCase(leaf)) {
            return typeFolder;
        }
        return ensureNamedDocumentSubfolder(typeFolder, leaf);
    }

    /**
     * Ensures the student folder under the chosen placement year/semester in the office tree
     * (same structure shown in the explorer: Year → Semester → Student ID).
     */
    @Transactional
    public FolderEntity ensureOfficeStudentFolder(
            String studentNumber,
            String faculty,
            String department,
            String academicYear,
            String semester,
            UserRole structureOwnerRole
    ) {
        if (studentNumber == null || studentNumber.isBlank()) {
            throw new IllegalArgumentException("Student ID is required.");
        }
        return resolveStudentRootFolder(
                studentNumber.trim().toUpperCase(Locale.ROOT),
                faculty,
                department,
                academicYear,
                semester,
                structureOwnerRole
        );
    }

    private FolderEntity ensureNamedDocumentSubfolder(FolderEntity parent, String folderName) {
        String trimmedName = folderName.trim();
        Optional<FolderEntity> existing = findChildFolderByName(parent.getId(), trimmedName);
        if (existing.isPresent()) {
            return existing.get();
        }
        String code = parent.getCode() + "-FLD-" + sanitizeCode(trimmedName);
        return folderService.resolveOrCreateFolder(trimmedName, code, parent.getId());
    }

    private Optional<FolderEntity> findChildFolderByName(Long parentId, String folderName) {
        if (parentId == null || folderName == null || folderName.isBlank()) {
            return Optional.empty();
        }
        String normalized = folderName.trim();
        return folderRepository.findAll().stream()
                .filter(folder -> Objects.equals(folder.getParentId(), parentId))
                .filter(folder -> folder.getName() != null && folder.getName().equalsIgnoreCase(normalized))
                .findFirst();
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

    /** Document-type subfolder created under a semester student ID during office upload/import. */
    public static boolean isOfficeUploadSubfolderCode(String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        return code.toUpperCase(Locale.ROOT).contains("-FLD-");
    }

    /** Nested year/category folders previously created under a student ID during upload. */
    public static boolean isDocumentChannelFolderCode(String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        String normalized = code.toUpperCase(Locale.ROOT);
        return normalized.contains("-INAY-")
                || normalized.contains("-INSEM-")
                || normalized.contains("-CAT-")
                || normalized.contains("-TYP-")
                || normalized.endsWith("-SAPP");
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
            String semesterOverride,
            UserRole structureOwnerRole
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
                term.academicYear(),
                structureOwnerRole
        );
        FolderEntity academicYearFolder = folderService.resolveOrCreateFolder(
                term.academicYear(),
                academicYearCode,
                departmentFolder.getId(),
                structureOwnerRole
        );

        String semesterCode = academicTermService.buildSemesterFolderCode(
                academicYearFolder.getCode(),
                term.startYear(),
                term.semesterNumber()
        );
        FolderEntity semesterFolder = folderService.resolveOrCreateFolder(
                term.semesterFolderName(),
                semesterCode,
                academicYearFolder.getId(),
                structureOwnerRole
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
