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
import java.util.List;
import java.util.Locale;

@Service
public class StudentService {
    private final StudentRepository studentRepository;
    private final DocumentRepository documentRepository;
    private final FolderService folderService;
    private final ArchiveAccessService accessService;
    private final StudentIdFormatService studentIdFormatService;
    private final ArchiveTreeService archiveTreeService;

    public StudentService(
            StudentRepository studentRepository,
            DocumentRepository documentRepository,
            FolderService folderService,
            ArchiveAccessService accessService,
            StudentIdFormatService studentIdFormatService,
            ArchiveTreeService archiveTreeService
    ) {
        this.studentRepository = studentRepository;
        this.documentRepository = documentRepository;
        this.folderService = folderService;
        this.accessService = accessService;
        this.studentIdFormatService = studentIdFormatService;
        this.archiveTreeService = archiveTreeService;
    }

    public StudentEntity getStudentOrThrow(String studentNumber) {
        String normalized = normalize(studentNumber);
        return studentRepository.findByStudentNumber(normalized)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found: " + normalized));
    }

    @Transactional
    public StudentEntity resolveOrCreate(String studentNumber, String studentName, String faculty, String department) {
        String normalizedNumber = normalize(studentNumber);
        String normalizedName = normalizeName(studentName);
        String normalizedFaculty = normalizeOptional(faculty);
        String normalizedDepartment = normalizeOptional(department);

        StudentEntity existing = studentRepository.findByStudentNumber(normalizedNumber).orElse(null);
        if (existing != null) {
            if (normalizedName != null && !existing.getFullName().equalsIgnoreCase(normalizedName)) {
                throw new IllegalArgumentException("Student ID " + normalizedNumber + " already belongs to " + existing.getFullName());
            }
            boolean changed = false;
            if ((existing.getFaculty() == null || existing.getFaculty().isBlank()) && normalizedFaculty != null) {
                existing.setFaculty(normalizedFaculty);
                changed = true;
            }
            if ((existing.getDepartment() == null || existing.getDepartment().isBlank()) && normalizedDepartment != null) {
                existing.setDepartment(normalizedDepartment);
                changed = true;
            }
            if (changed) {
                existing = studentRepository.save(existing);
            }
            return existing;
        }

        if (normalizedName == null) {
            throw new IllegalArgumentException("Student name is required for a new student");
        }

        studentIdFormatService.requireRecognizedFormat(normalizedNumber);
        if (!studentIdFormatService.isLegacyFormat(normalizedNumber)) {
            studentIdFormatService.validateDepartmentMatch(normalizedNumber, normalizedDepartment);
        }

        if (normalizedDepartment == null) {
            normalizedDepartment = studentIdFormatService.resolveDepartmentName(normalizedNumber).orElse(null);
        }
        if (normalizedFaculty == null) {
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
                .map(this::toListItem)
                .toList();

        return new StudentArchiveResponse(
                student.getStudentNumber(),
                student.getFullName(),
                student.getFaculty(),
                student.getDepartment(),
                archiveTreeService.findStudentFolderId(student).orElse(null),
                documents.size(),
                documents
        );
    }

    public StudentLookupResponse lookupStudent(String studentNumber, String rawRole, String rawSessionStudentNumber) {
        String normalized = normalize(studentNumber);
        if (studentRepository.findByStudentNumber(normalized).isEmpty()) {
            return StudentLookupResponse.notFound(normalized);
        }
        return StudentLookupResponse.fromArchive(getStudentArchive(studentNumber, rawRole, rawSessionStudentNumber));
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

    private DocumentListItemResponse toListItem(DocumentEntity document) {
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
                document.getReviewNote()
        );
    }
}
