package com.auca.archive.service;

import com.auca.archive.domain.UserRole;
import com.auca.archive.model.StudentEntity;
import com.auca.archive.repository.DocumentRepository;
import com.auca.archive.repository.StudentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentServiceEnrollmentTest {
    @Mock
    private StudentRepository studentRepository;
    @Mock
    private DocumentRepository documentRepository;
    @Mock
    private FolderService folderService;
    @Mock
    private ArchiveAccessService accessService;
    @Mock
    private StudentIdFormatService studentIdFormatService;
    @Mock
    private ArchiveTreeService archiveTreeService;
    @Mock
    private StudentEnrollmentService studentEnrollmentService;

    private StudentService studentService;

    @BeforeEach
    void setUp() {
        studentService = new StudentService(
                studentRepository,
                documentRepository,
                folderService,
                accessService,
                studentIdFormatService,
                archiveTreeService,
                studentEnrollmentService
        );
    }

    @Test
    void financeRoleCannotCreateNewStudent() {
        when(studentRepository.findByStudentNumber("99999")).thenReturn(Optional.empty());

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> studentService.resolveOrCreate(
                        "99999",
                        "Unknown Student",
                        "Faculty of Business Administration",
                        "Management",
                        true,
                        UserRole.FINANCE
                )
        );

        assertEquals(StudentEnrollmentService.ONLY_REGISTRAR_REGISTER_MESSAGE, error.getMessage());
        verify(studentRepository, never()).save(any());
    }

    @Test
    void registrarCanCreateNewStudent() {
        when(studentRepository.findByStudentNumber("99999")).thenReturn(Optional.empty());
        doNothing().when(studentIdFormatService).requireRecognizedFormat("99999");
        when(studentRepository.save(any(StudentEntity.class))).thenAnswer(invocation -> {
            StudentEntity saved = invocation.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        StudentEntity created = studentService.resolveOrCreate(
                "99999",
                "New Student",
                "Faculty of Business Administration",
                "Management",
                true,
                UserRole.REGISTRAR
        );

        assertEquals("99999", created.getStudentNumber());
        assertEquals(UserRole.REGISTRAR, created.getRegisteredByRole());
        verify(studentRepository).save(any(StudentEntity.class));
    }
}
