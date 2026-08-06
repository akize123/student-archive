package com.auca.archive.service;

import com.auca.archive.domain.FacultyCatalog;
import com.auca.archive.domain.UserRole;
import com.auca.archive.model.AccountEntity;
import com.auca.archive.model.StudentEntity;
import com.auca.archive.repository.AccountRepository;
import com.auca.archive.repository.StudentRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class StudentAccountProvisioningService {
    private final StudentService studentService;
    private final ArchiveTreeService archiveTreeService;
    private final StudentIdFormatService studentIdFormatService;
    private final AccountRepository accountRepository;
    private final StudentRepository studentRepository;
    private final StudentEnrollmentService studentEnrollmentService;

    public StudentAccountProvisioningService(
            StudentService studentService,
            ArchiveTreeService archiveTreeService,
            StudentIdFormatService studentIdFormatService,
            AccountRepository accountRepository,
            StudentRepository studentRepository,
            StudentEnrollmentService studentEnrollmentService
    ) {
        this.studentService = studentService;
        this.archiveTreeService = archiveTreeService;
        this.studentIdFormatService = studentIdFormatService;
        this.accountRepository = accountRepository;
        this.studentRepository = studentRepository;
        this.studentEnrollmentService = studentEnrollmentService;
    }

    @Transactional
    public void linkStudentAccount(
            AccountEntity account,
            String studentNumber,
            String fullName,
            String faculty,
            String academicDepartment,
            Long excludeAccountId
    ) {
        if (account.getRole() != UserRole.STUDENT) {
            account.setStudentNumber(null);
            return;
        }

        String resolvedNumber = resolveStudentNumber(studentNumber, account);
        ensureStudentNumberAvailable(resolvedNumber, excludeAccountId);
        studentEnrollmentService.requireRegistrarEnrollment(resolvedNumber);
        StudentEntity student = studentService.findByStudentNumber(resolvedNumber)
                .orElseThrow(() -> new IllegalArgumentException(
                        StudentEnrollmentService.formatNotRegisteredMessage(resolvedNumber)));

        String resolvedFaculty = trimToNull(faculty);
        String resolvedDepartment = trimToNull(academicDepartment);
        if (resolvedFaculty != null || resolvedDepartment != null) {
            if (resolvedFaculty != null) {
                FacultyCatalog.requireValidDeanFaculty(resolvedFaculty);
                student.setFaculty(resolvedFaculty);
            }
            if (resolvedDepartment != null) {
                student.setDepartment(resolvedDepartment);
            }
            if (resolvedFaculty != null
                    && resolvedDepartment != null
                    && !FacultyCatalog.isDepartmentInFaculty(resolvedDepartment, resolvedFaculty)) {
                throw new IllegalArgumentException(
                        "Department \"" + resolvedDepartment + "\" does not belong to " + resolvedFaculty + ".");
            }
            student = studentRepository.save(student);
        }

        // Store under Registrar archive path for faculty/department; login tree stays student workspace.
        archiveTreeService.ensureStudentWorkspace(
                student,
                student.getFaculty(),
                student.getDepartment(),
                null,
                null,
                true,
                UserRole.REGISTRAR
        );
        account.setStudentNumber(student.getStudentNumber());
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    @Transactional
    public AccountEntity syncStudentAccount(AccountEntity account) {
        if (account.getRole() != UserRole.STUDENT) {
            return account;
        }
        linkStudentAccount(
                account,
                account.getStudentNumber(),
                account.getFullName(),
                null,
                null,
                account.getId()
        );
        return account;
    }

    public String resolveStudentNumber(String studentNumber, AccountEntity account) {
        if (studentNumber != null && !studentNumber.isBlank()) {
            return studentNumber.trim().toUpperCase(Locale.ROOT);
        }
        if (account.getStudentNumber() != null && !account.getStudentNumber().isBlank()) {
            return account.getStudentNumber().trim().toUpperCase(Locale.ROOT);
        }
        if (account.getUsername() != null && !account.getUsername().isBlank()) {
            String candidate = account.getUsername().trim().toUpperCase(Locale.ROOT);
            if (studentIdFormatService.isRecognizedFormat(candidate)) {
                return candidate;
            }
        }
        throw new IllegalArgumentException("Student ID is required for student accounts");
    }

    private void ensureStudentNumberAvailable(String studentNumber, Long excludeAccountId) {
        accountRepository.findByStudentNumberIgnoreCase(studentNumber).ifPresent(existing -> {
            if (excludeAccountId == null || !excludeAccountId.equals(existing.getId())) {
                throw new IllegalArgumentException("Student ID " + studentNumber + " is already linked to " + existing.getFullName());
            }
        });
    }
}
