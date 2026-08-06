package com.auca.archive.service;

import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.StudentEnrollmentResponse;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.model.StudentEntity;
import com.auca.archive.repository.FolderRepository;
import com.auca.archive.repository.StudentRepository;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class StudentEnrollmentService {
    public static final String NOT_REGISTERED_MESSAGE =
            "Student %s is not registered. Ask the Registrar to create this student ID first.";
    public static final String ONLY_REGISTRAR_REGISTER_MESSAGE =
            "Only the Registrar can register new students in the archive.";
    public static final String ONLY_REGISTRAR_OR_DEAN_REGISTER_MESSAGE =
            "Only the Registrar or Dean of Faculty can register new students in the archive.";
    public static final String DEAN_CANNOT_REGISTER_MESSAGE =
            "Deans cannot register new students. Ask the Registrar to create the student ID first, then use Upload to add documents for that student.";
    public static final String DEAN_STUDENT_NOT_REGISTERED_MESSAGE =
            "Student %s is not registered in the archive. Ask the Registrar to create this student ID first, then search again to upload documents.";

    private final StudentRepository studentRepository;
    private final FolderRepository folderRepository;
    private final ArchiveAccessService accessService;
    private final StudentIdFormatService studentIdFormatService;

    public StudentEnrollmentService(
            StudentRepository studentRepository,
            FolderRepository folderRepository,
            ArchiveAccessService accessService,
            StudentIdFormatService studentIdFormatService
    ) {
        this.studentRepository = studentRepository;
        this.folderRepository = folderRepository;
        this.accessService = accessService;
        this.studentIdFormatService = studentIdFormatService;
    }

    public boolean isRegisteredByRegistrar(String studentNumber) {
        return findRegistrarStudentFolder(studentNumber).isPresent();
    }

    public void requireRegistrarEnrollment(String studentNumber) {
        if (!isRegisteredByRegistrar(studentNumber)) {
            throw new IllegalArgumentException(formatNotRegisteredMessage(studentNumber));
        }
    }

    public StudentEnrollmentResponse getEnrollment(String studentNumber) {
        String normalized = normalize(studentNumber);
        Optional<StudentEntity> student = studentRepository.findByStudentNumber(normalized);
        Optional<FolderEntity> registrarFolder = findRegistrarStudentFolder(normalized);
        if (student.isEmpty() || registrarFolder.isEmpty()) {
            return StudentEnrollmentResponse.notRegistered(normalized);
        }
        StudentEntity entity = student.get();
        return new StudentEnrollmentResponse(
                true,
                entity.getStudentNumber(),
                entity.getFullName(),
                entity.getFaculty(),
                entity.getDepartment(),
                registrarFolder.get().getId()
        );
    }

    public void requireEnrollmentForRole(String studentNumber, UserRole role, String viewerFaculty) {
        String normalized = normalize(studentNumber);
        StudentEntity student = studentRepository.findByStudentNumber(normalized).orElse(null);
        if (role == UserRole.DEAN_OF_FACULTY) {
            if (student == null) {
                throw new IllegalArgumentException(formatDeanStudentNotRegisteredMessage(studentNumber));
            }
            accessService.requireStudentInDeanFaculty(student, viewerFaculty);
            return;
        }
        requireRegistrarEnrollment(studentNumber);
    }

    public FolderEntity linkStudentToRoleBranch(String studentNumber, Long semesterFolderId, UserRole role) {
        return linkStudentToRoleBranch(studentNumber, semesterFolderId, role, null);
    }

    public FolderEntity linkStudentToRoleBranch(
            String studentNumber,
            Long semesterFolderId,
            UserRole role,
            String viewerFaculty
    ) {
        String normalized = normalize(studentNumber);
        StudentEntity student = studentRepository.findByStudentNumber(normalized)
                .orElseThrow(() -> new IllegalArgumentException(formatNotRegisteredMessage(studentNumber)));
        if (role == UserRole.DEAN_OF_FACULTY) {
            accessService.requireStudentInDeanFaculty(student, viewerFaculty);
        } else {
            requireRegistrarEnrollment(studentNumber);
        }

        FolderEntity semesterFolder = folderRepository.findById(semesterFolderId)
                .orElseThrow(() -> new IllegalArgumentException("Folder not found: " + semesterFolderId));
        if (!isSemesterFolderOnly(semesterFolder)) {
            throw new IllegalArgumentException("Student linking is only available from a semester folder");
        }

        String studentCode = semesterFolder.getCode() + "-STU-" + sanitizeStudentCode(student.getStudentNumber());
        return folderRepository.findByCode(studentCode)
                .orElseGet(() -> folderRepository.save(
                        new FolderEntity(student.getStudentNumber(), studentCode, semesterFolder.getId())
                ));
    }

    public Optional<Long> findRegistrarStudentFolderId(String studentNumber) {
        return findStudentFolderInRoleBranch(studentNumber, UserRole.REGISTRAR).map(FolderEntity::getId);
    }

    public Optional<Long> findRoleBranchStudentFolderId(String studentNumber, UserRole role) {
        return findStudentFolderInRoleBranch(studentNumber, role).map(FolderEntity::getId);
    }

    private Optional<FolderEntity> findRegistrarStudentFolder(String studentNumber) {
        return findStudentFolderInRoleBranch(studentNumber, UserRole.REGISTRAR);
    }

    private Optional<FolderEntity> findStudentFolderInRoleBranch(String studentNumber, UserRole role) {
        if (studentNumber == null || studentNumber.isBlank()) {
            return Optional.empty();
        }
        String normalized = normalize(studentNumber);
        if (studentRepository.findByStudentNumber(normalized).isEmpty()) {
            return Optional.empty();
        }

        String marker = "-STU-" + sanitizeStudentCode(normalized);
        Map<Long, FolderEntity> folderById = folderRepository.findByArchivedAtIsNull().stream()
                .collect(Collectors.toMap(FolderEntity::getId, Function.identity(), (left, right) -> left));

        return folderRepository.findByArchivedAtIsNull().stream()
                .filter(folder -> folder.getCode() != null)
                .filter(folder -> ArchiveTreeService.isSemesterStudentRootFolder(folder.getCode()))
                .filter(folder -> folder.getCode().toUpperCase(Locale.ROOT).endsWith(marker))
                .filter(folder -> matchesRoleBranch(folder, folderById, role))
                .findFirst();
    }

    private boolean matchesRoleBranch(FolderEntity folder, Map<Long, FolderEntity> folderById, UserRole role) {
        UserRole ownerRole = accessService.resolveStructureOwnerRole(folder, folderById);
        if (role == null || role == UserRole.ADMIN) {
            return true;
        }
        if (role == UserRole.REGISTRAR) {
            return ownerRole == null || ownerRole == UserRole.REGISTRAR;
        }
        return role == ownerRole;
    }

    private boolean isRegistrarBranchFolder(FolderEntity folder, Map<Long, FolderEntity> folderById) {
        return matchesRoleBranch(folder, folderById, UserRole.REGISTRAR);
    }

    private boolean isSemesterFolderOnly(FolderEntity folder) {
        if (folder == null || folder.getCode() == null) {
            return false;
        }
        String code = folder.getCode().toUpperCase(Locale.ROOT);
        return code.contains("-SEM-") && !code.contains("-STU-");
    }

    private String sanitizeStudentCode(String value) {
        if (value == null || value.isBlank()) {
            return "UNKNOWN";
        }
        return value.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }

    private String normalize(String studentNumber) {
        return studentIdFormatService.normalizeStaffFolderName(studentNumber);
    }

    public static String formatNotRegisteredMessage(String studentNumber) {
        String normalized = studentNumber == null ? "" : studentNumber.trim().toUpperCase(Locale.ROOT);
        return NOT_REGISTERED_MESSAGE.formatted(normalized);
    }

    public static String formatDeanStudentNotRegisteredMessage(String studentNumber) {
        String normalized = studentNumber == null ? "" : studentNumber.trim().toUpperCase(Locale.ROOT);
        return DEAN_STUDENT_NOT_REGISTERED_MESSAGE.formatted(normalized);
    }
}
