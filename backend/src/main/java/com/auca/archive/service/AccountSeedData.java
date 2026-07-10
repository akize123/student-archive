package com.auca.archive.service;

import com.auca.archive.domain.UserRole;
import com.auca.archive.model.StudentEntity;
import com.auca.archive.repository.StudentRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class AccountSeedData implements CommandLineRunner {
    private static final String DEMO_STUDENT_NUMBER = "20251SEN001";
    private static final String LEGACY_DEMO_STUDENT_NUMBER = "25876";

    private final AccountService accountService;
    private final StudentService studentService;
    private final StudentRepository studentRepository;

    public AccountSeedData(
            AccountService accountService,
            StudentService studentService,
            StudentRepository studentRepository
    ) {
        this.accountService = accountService;
        this.studentService = studentService;
        this.studentRepository = studentRepository;
    }

    @Override
    public void run(String... args) {
        accountService.ensureAccount("admin", "System Administrator", "Admin@123", UserRole.ADMIN, UserRole.ADMIN.getDepartment());
        accountService.ensureAccount("registrar", "Registrar Office", "Registrar@123", UserRole.REGISTRAR, UserRole.REGISTRAR.getDepartment());
        accountService.ensureAccount("exam.officer", "Examination Officer", "Exam@123", UserRole.EXAMINATION_OFFICER, UserRole.EXAMINATION_OFFICER.getDepartment());
        accountService.ensureAccount("hod", "Head of Department", "Hod@123", UserRole.HOD, UserRole.HOD.getDepartment());
        accountService.ensureAccount("librarian", "University Librarian", "Library@123", UserRole.LIBRARIAN, UserRole.LIBRARIAN.getDepartment());

        StudentEntity student = studentRepository.findByStudentNumber(DEMO_STUDENT_NUMBER)
                .or(() -> studentRepository.findByStudentNumber(LEGACY_DEMO_STUDENT_NUMBER))
                .orElseGet(() -> studentService.resolveOrCreate(
                        DEMO_STUDENT_NUMBER,
                        "Abikunda Mugisha",
                        "Faculty of Information Technology",
                        "Software Engineering"
                ));

        accountService.ensureAccount(
                student.getStudentNumber(),
                student.getFullName(),
                "Student@123",
                UserRole.STUDENT,
                UserRole.STUDENT.getDepartment(),
                student.getStudentNumber()
        );
    }
}
