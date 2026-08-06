package com.auca.archive.controller;

import com.auca.archive.dto.StudentArchiveResponse;
import com.auca.archive.dto.StudentEnrollmentResponse;
import com.auca.archive.dto.StudentLookupResponse;
import com.auca.archive.service.AccountService;
import com.auca.archive.service.ArchiveAccessService;
import com.auca.archive.service.StudentEnrollmentService;
import com.auca.archive.service.StudentService;
import com.auca.archive.web.SessionRequestContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/students")
public class StudentController {
    private final StudentService studentService;
    private final StudentEnrollmentService studentEnrollmentService;
    private final AccountService accountService;
    private final ArchiveAccessService accessService;

    public StudentController(
            StudentService studentService,
            StudentEnrollmentService studentEnrollmentService,
            AccountService accountService,
            ArchiveAccessService accessService
    ) {
        this.studentService = studentService;
        this.studentEnrollmentService = studentEnrollmentService;
        this.accountService = accountService;
        this.accessService = accessService;
    }

    private String resolveViewerDepartment(String role, String accountId, String departmentHeader) {
        return SessionRequestContext.resolveViewerDepartment(accountService, accessService, role, accountId, departmentHeader);
    }

    @GetMapping("/{studentNumber}/lookup")
    public StudentLookupResponse lookupStudent(
            @PathVariable String studentNumber,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String sessionStudentNumber,
            @RequestHeader(value = "X-User-Department", required = false) String department,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId
    ) {
        String viewerDepartment = resolveViewerDepartment(role, accountId, department);
        return studentService.lookupStudent(studentNumber, role, sessionStudentNumber, viewerDepartment);
    }

    @GetMapping("/{studentNumber}/enrollment")
    public StudentEnrollmentResponse getEnrollment(@PathVariable String studentNumber) {
        return studentEnrollmentService.getEnrollment(studentNumber);
    }

    @GetMapping("/{studentNumber}")
    public StudentArchiveResponse getStudentArchive(
            @PathVariable String studentNumber,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String sessionStudentNumber
    ) {
        return studentService.getStudentArchive(studentNumber, role, sessionStudentNumber);
    }
}
