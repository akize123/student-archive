package com.auca.archive.controller;

import com.auca.archive.dto.StudentArchiveResponse;
import com.auca.archive.dto.StudentLookupResponse;
import com.auca.archive.service.StudentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/students")
public class StudentController {
    private final StudentService studentService;

    public StudentController(StudentService studentService) {
        this.studentService = studentService;
    }

    @GetMapping("/{studentNumber}/lookup")
    public StudentLookupResponse lookupStudent(
            @PathVariable String studentNumber,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Student-Number", required = false) String sessionStudentNumber
    ) {
        return studentService.lookupStudent(studentNumber, role, sessionStudentNumber);
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
