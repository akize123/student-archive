package com.auca.archive.service;

import com.auca.archive.dto.DocumentListItemResponse;
import com.auca.archive.dto.StudentArchiveResponse;
import com.auca.archive.dto.StudentLookupResponse;
import com.auca.archive.model.DocumentEntity;
import com.auca.archive.model.StudentEntity;
import com.auca.archive.repository.DocumentRepository;
import com.auca.archive.repository.StudentRepository;
import jakarta.transaction.Transactional;
import com.auca.archive.domain.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class StudentService {
    private final StudentRepository studentRepository;
    private final DocumentRepository documentRepository;
    private final FolderService folderService;
    private final ArchiveAccessService accessService;
    private final StudentIdFormatService studentIdFormatService;
    private final ArchiveTreeService archiveTreeService;
    private final StudentEnrollmentService studentEnrollmentService;

    public StudentService(
            StudentRepository studentRepository,
            DocumentRepository documentRepository,
            FolderService folderService,
            ArchiveAccessService accessService,
            StudentIdFormatService studentIdFormatService,
            ArchiveTreeService archiveTreeService,
            StudentEnrollmentService studentEnrollmentService
    ) {
        this.studentRepository = studentRepository;
        this.documentRepository = documentRepository;
        this.folderService = folderService;
        this.accessService = accessService;
        this.studentIdFormatService = studentIdFormatService;
        this.archiveTreeService = archiveTreeService;
        this.studentEnrollmentService = studentEnrollmentService;
    }

    public StudentEntity getStudentOrThrow(String studentNumber) {
        String normalized = normalize(studentNumber);
        return studentRepository.findByStudentNumber(normalized)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found: " + normalized));
    }

    public StudentEntity requireExistingStudent(String studentNumber) {
        return getStudentOrThrow(studentNumber);
    }

    public Optional<StudentEntity> findByStudentNumber(String studentNumber) {
        if (studentNumber == null || studentNumber.isBlank()) {
            return Optional.empty();
        }
        return studentRepository.findByStudentNumber(normalize(studentNumber));
    }

    @Transactional
    public StudentEntity resolveOrCreate(String studentNumber, String studentName, String faculty, String department) {
        return resolveOrCreate(studentNumber, studentName, faculty, department, false, UserRole.REGISTRAR);
    }

    @Transactional
    public StudentEntity resolveOrCreate(
            String studentNumber,
            String studentName,
            String faculty,
            String department,
            boolean placementFromArchiveContext
    ) {
        return resolveOrCreate(studentNumber, studentName, faculty, department, placementFromArchiveContext, UserRole.REGISTRAR);
    }

    @Transactional
    public StudentEntity resolveOrCreate(
            String studentNumber,
            String studentName,
            String faculty,
            String department,
            boolean placementFromArchiveContext,
            UserRole creatorRole
    ) {
        String normalizedNumber = normalize(studentNumber);
        String normalizedName = normalizeName(studentName);
        String normalizedFaculty = normalizeOptional(faculty);
        String normalizedDepartment = normalizeOptional(department);

        StudentEntity existing = studentRepository.findByStudentNumber(normalizedNumber).orElse(null);
        if (existing != null) {
            if (creatorRole == UserRole.DEAN_OF_FACULTY && normalizedFaculty != null) {
                accessService.requireStudentInDeanFaculty(existing, normalizedFaculty);
            } else {
                rejectCrossDepartmentPlacement(existing, normalizedFaculty, normalizedDepartment);
            }
            boolean changed = false;
            if (normalizedName != null && !normalizedName.isBlank()) {
                if (placementFromArchiveContext
                        && !normalizedName.equalsIgnoreCase(normalizedNumber)
                        && !normalizedName.equals(existing.getFullName())) {
                    existing.setFullName(normalizedName);
                    changed = true;
                } else if (!existing.getFullName().equalsIgnoreCase(normalizedName)) {
                    throw new IllegalArgumentException("Student ID " + normalizedNumber + " already belongs to " + existing.getFullName());
                } else if (!existing.getFullName().equals(normalizedName)) {
                    existing.setFullName(normalizedName);
                    changed = true;
                }
            }
            if ((existing.getFaculty() == null || existing.getFaculty().isBlank()) && normalizedFaculty != null) {
                existing.setFaculty(normalizedFaculty);
                changed = true;
            }
            if ((existing.getDepartment() == null || existing.getDepartment().isBlank()) && normalizedDepartment != null) {
                existing.setDepartment(normalizedDepartment);
                changed = true;
            }
            if (existing.getRegisteredByRole() == null) {
                existing.setRegisteredByRole(UserRole.REGISTRAR);
                changed = true;
            }
            if (changed) {
                existing = studentRepository.save(existing);
            }
            return existing;
        }

        if (!canCreateStudent(creatorRole)) {
            throw new IllegalArgumentException(StudentEnrollmentService.ONLY_REGISTRAR_REGISTER_MESSAGE);
        }

        if (normalizedName == null) {
            throw new IllegalArgumentException("Student name is required for a new student");
        }

        studentIdFormatService.requireRecognizedFormat(normalizedNumber);
        if (!placementFromArchiveContext && !studentIdFormatService.isLegacyFormat(normalizedNumber)) {
            studentIdFormatService.validateDepartmentMatch(normalizedNumber, normalizedDepartment);
        }

        if (normalizedDepartment == null && !placementFromArchiveContext) {
            normalizedDepartment = studentIdFormatService.resolveDepartmentName(normalizedNumber).orElse(null);
        }
        if (normalizedFaculty == null && !placementFromArchiveContext) {
            normalizedFaculty = studentIdFormatService.resolveFacultyName(normalizedNumber).orElse(null);
        }

        if (normalizedFaculty == null || normalizedDepartment == null) {
            throw new IllegalArgumentException("Faculty and department are required for a new student");
        }

        StudentEntity created = new StudentEntity();
        created.setStudentNumber(normalizedNumber);
        created.setFullName(normalizedName);
        created.setFaculty(normalizedFaculty);
        created.setDepartment(normalizedDepartment);
        created.setRegisteredByRole(resolveRegisteredByRole(creatorRole));
        created.setCreatedAt(LocalDateTime.now());
        return studentRepository.save(created);
    }

    public StudentArchiveResponse getStudentArchive(String studentNumber) {
        return getStudentArchive(studentNumber, null);
    }

    public StudentArchiveResponse getStudentArchive(String studentNumber, String rawRole) {
        return getStudentArchive(studentNumber, rawRole, null);
    }

    public StudentArchiveResponse getStudentArchive(String studentNumber, String rawRole, String rawSessionStudentNumber) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        accessService.requireOwnStudentNumber(role, rawSessionStudentNumber, studentNumber);
        StudentEntity student = getStudentOrThrow(studentNumber);
        List<DocumentListItemResponse> documents = documentRepository
                .findByStudentNumberOrderByIssueDateDesc(student.getStudentNumber())
                .stream()
                .filter(document -> !document.isArchivedForRemoval())
                .filter(document -> folderService.isDocumentAccessible(document, role, rawSessionStudentNumber))
                .map(document -> toListItem(document, role, rawSessionStudentNumber))
                .toList();

        ArchiveTreeService.StudentUploadPlacement placement = archiveTreeService.resolveStudentUploadPlacement(student);

        Long folderId = resolveLookupFolderId(student, role);

        return new StudentArchiveResponse(
                student.getStudentNumber(),
                student.getFullName(),
                placement.faculty(),
                placement.department(),
                placement.academicYear(),
                placement.semester(),
                folderId,
                documents.size(),
                documents
        );
    }

    private Long resolveLookupFolderId(StudentEntity student, UserRole role) {
        if (role != null && role != UserRole.STUDENT) {
            Optional<Long> roleFolder = studentEnrollmentService.findRoleBranchStudentFolderId(
                    student.getStudentNumber(),
                    role
            );
            if (roleFolder.isPresent()) {
                return roleFolder.get();
            }
        }
        return archiveTreeService.findStudentFolderId(student).orElse(null);
    }

    public StudentLookupResponse lookupStudent(String studentNumber, String rawRole, String rawSessionStudentNumber) {
        return lookupStudent(studentNumber, rawRole, rawSessionStudentNumber, null);
    }

    public StudentLookupResponse lookupStudent(
            String studentNumber,
            String rawRole,
            String rawSessionStudentNumber,
            String rawViewerFaculty
    ) {
        String normalized = normalize(studentNumber);
        Optional<StudentEntity> studentOptional = studentRepository.findByStudentNumber(normalized);
        if (studentOptional.isEmpty()) {
            return StudentLookupResponse.notFound(normalized);
        }
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String viewerFaculty = accessService.normalizeViewerDepartment(rawViewerFaculty);
        StudentEntity student = studentOptional.get();
        if (role == UserRole.DEAN_OF_FACULTY) {
            accessService.requireDeanFaculty(role, viewerFaculty);
            if (!accessService.isStudentInDeanFaculty(student, viewerFaculty)) {
                throw new IllegalArgumentException(
                        accessService.formatDeanFacultyMismatchMessage(student.getFaculty(), viewerFaculty));
            }
        }
        StudentArchiveResponse archive = getStudentArchive(studentNumber, rawRole, rawSessionStudentNumber);
        boolean registeredByRegistrar = studentEnrollmentService.isRegisteredByRegistrar(normalized);
        return StudentLookupResponse.fromArchive(archive, registeredByRegistrar);
    }

    public List<String> detectConflicts(
            String studentNumber,
            String studentName,
            String faculty,
            String department,
            boolean dryRun
    ) {
        List<String> conflicts = new ArrayList<>();
        String normalizedNumber;
        try {
            normalizedNumber = normalize(studentNumber);
        } catch (IllegalArgumentException ex) {
            conflicts.add(ex.getMessage());
            return conflicts;
        }

        StudentEntity existing = studentRepository.findByStudentNumber(normalizedNumber).orElse(null);
        if (existing == null) {
            return conflicts;
        }

        String normalizedName = normalizeName(studentName);
        if (normalizedName != null && !existing.getFullName().equalsIgnoreCase(normalizedName)) {
            conflicts.add("Student ID " + normalizedNumber + " already belongs to " + existing.getFullName());
        }
        if (department != null
                && existing.getDepartment() != null
                && !existing.getDepartment().isBlank()
                && !existing.getDepartment().equalsIgnoreCase(department.trim())) {
            conflicts.add("Student " + normalizedNumber + " is registered under " + existing.getDepartment()
                    + ", not " + department.trim());
        }
        if (faculty != null
                && existing.getFaculty() != null
                && !existing.getFaculty().isBlank()
                && !existing.getFaculty().equalsIgnoreCase(faculty.trim())) {
            conflicts.add("Student " + normalizedNumber + " is registered under " + existing.getFaculty()
                    + ", not " + faculty.trim());
        }
        return conflicts;
    }

    private boolean canCreateStudent(UserRole creatorRole) {
        return creatorRole == UserRole.REGISTRAR || creatorRole == UserRole.ADMIN;
    }

    private UserRole resolveRegisteredByRole(UserRole creatorRole) {
        if (creatorRole == UserRole.ADMIN || creatorRole == UserRole.REGISTRAR) {
            return UserRole.REGISTRAR;
        }
        return creatorRole;
    }

    private void rejectCrossDepartmentPlacement(
            StudentEntity existing,
            String requestedFaculty,
            String requestedDepartment
    ) {
        if (requestedDepartment != null
                && existing.getDepartment() != null
                && !existing.getDepartment().isBlank()
                && !existing.getDepartment().equalsIgnoreCase(requestedDepartment)) {
            throw new IllegalArgumentException("Student ID " + existing.getStudentNumber()
                    + " is already registered under " + existing.getDepartment()
                    + ". Upload to that student's existing location instead.");
        }
        if (requestedFaculty != null
                && existing.getFaculty() != null
                && !existing.getFaculty().isBlank()
                && !existing.getFaculty().equalsIgnoreCase(requestedFaculty)) {
            throw new IllegalArgumentException("Student ID " + existing.getStudentNumber()
                    + " is already registered under " + existing.getFaculty()
                    + ". Upload to that student's existing location instead.");
        }
    }

    private String normalize(String studentNumber) {
        if (studentNumber == null || studentNumber.isBlank()) {
            throw new IllegalArgumentException("Student ID is required");
        }
        return studentNumber.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeName(String studentName) {
        if (studentName == null || studentName.isBlank()) {
            return null;
        }
        return studentName.trim();
    }

    private String normalizeOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private DocumentListItemResponse toListItem(DocumentEntity document, UserRole role, String studentNumber) {
        return new DocumentListItemResponse(
                document.getId(),
                document.getTitle(),
                document.getOwnerName(),
                document.getStudentNumber(),
                document.getDepartment(),
                document.getIssueDate(),
                document.getModifiedAt(),
                document.getStatus() == null ? null : document.getStatus().name(),
                document.getFileName(),
                document.getSizeBytes(),
                document.getPageCount(),
                document.getCategory() == null ? null : document.getCategory().name(),
                document.getType() == null ? null : document.getType().name(),
                document.getFolderId() == null
                        ? "Student Documents"
                        : folderService.getFolderOrThrow(document.getFolderId()).getName(),
                document.getFolderId(),
                document.getStarred(),
                document.getExamType(),
                document.getAcademicYear(),
                document.getSemester(),
                document.getCourse(),
                document.getMarks(),
                document.getExamRoom(),
                document.getArchivedAt(),
                document.getArchivedBy(),
                document.getGithubUrl(),
                document.getExternalLinks(),
                document.getReviewNote(),
                document.getDescription(),
                document.getCoverPhotoPath() != null && !document.getCoverPhotoPath().isBlank(),
                folderService.canDownloadDocument(document, role, studentNumber)
        );
    }
}
