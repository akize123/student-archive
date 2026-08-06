package com.auca.archive.service;

import com.auca.archive.domain.HodLoginPasswords;
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
        accountService.ensureAccount("finance", "Finance Office", "Finance@123", UserRole.FINANCE, UserRole.FINANCE.getDepartment());
        accountService.ensureAccount("exam.officer", "Examination Officer", "Exam@123", UserRole.EXAMINATION_OFFICER, UserRole.EXAMINATION_OFFICER.getDepartment());
        accountService.ensureAccount(
                "dean",
                "Dean of Faculty (FIT)",
                "Dean@123",
                UserRole.DEAN_OF_FACULTY,
                "Faculty of Information Technology"
        );
        accountService.ensureAccount("librarian", "University Librarian", "Library@123", UserRole.LIBRARIAN, UserRole.LIBRARIAN.getDepartment());

        accountService.ensureDemoHodAccount(
                HodLoginPasswords.DEMO_USERNAME,
                "Head of Department (" + HodLoginPasswords.DEMO_DEPARTMENT + ")",
                HodLoginPasswords.DEMO_PASSWORD,
                HodLoginPasswords.DEMO_DEPARTMENT
        );
        accountService.deactivateLegacyDemoHodAccounts(HodLoginPasswords.legacyDemoUsernames());
        accountService.deactivateAllHodAccountsExcept(HodLoginPasswords.DEMO_USERNAME);

        StudentEntity student = studentRepository.findByStudentNumber(DEMO_STUDENT_NUMBER)
                .or(() -> studentRepository.findByStudentNumber(LEGACY_DEMO_STUDENT_NUMBER))
                .orElseGet(() -> studentService.resolveOrCreate(
                        DEMO_STUDENT_NUMBER,
                        "Abikunda Mugisha",
                        "Faculty of Information Technology",
                        "Software Engineering",
                        false,
                        UserRole.ADMIN
                ));

        // Keep demo student login predictable (username = student ID, password Student@123).
        accountService.ensureDemoStudentAccount(
                student.getStudentNumber(),
                student.getFullName(),
                "Student@123",
                student.getStudentNumber()
        );
    }
}
