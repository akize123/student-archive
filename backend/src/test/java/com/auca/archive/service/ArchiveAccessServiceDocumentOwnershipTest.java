package com.auca.archive.service;

import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.model.DocumentEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ArchiveAccessServiceDocumentOwnershipTest {
    private ArchiveAccessService accessService;

    @BeforeEach
    void setUp() {
        accessService = new ArchiveAccessService();
    }

    @Test
    void registrarDoesNotSeeExaminationOfficerUploads() {
        DocumentEntity document = officeDocument(
                UserRole.EXAMINATION_OFFICER,
                StudentDocumentCategory.EXAMINATION_DOCUMENTS
        );

        assertFalse(accessService.canViewOfficeDocument(document, UserRole.REGISTRAR));
        assertTrue(accessService.canViewOfficeDocument(document, UserRole.EXAMINATION_OFFICER));
    }

    @Test
    void examinationOfficerDoesNotSeeRegistrarUploads() {
        DocumentEntity document = officeDocument(
                UserRole.REGISTRAR,
                StudentDocumentCategory.REGISTRATION_FORM
        );

        assertTrue(accessService.canViewOfficeDocument(document, UserRole.REGISTRAR));
        assertFalse(accessService.canViewOfficeDocument(document, UserRole.EXAMINATION_OFFICER));
    }

    @Test
    void librarianSeesStudentFinalYearProjectSubmissions() {
        DocumentEntity document = officeDocument(
                UserRole.STUDENT,
                StudentDocumentCategory.FINAL_YEAR_PROJECT
        );
        document.setStatus(DocumentStatus.PENDING);

        assertTrue(accessService.canViewOfficeDocument(document, UserRole.LIBRARIAN));
        assertFalse(accessService.canViewOfficeDocument(document, UserRole.REGISTRAR));
    }

    @Test
    void hodAndRegistrarApplicationDocumentsStaySeparateWhenTagged() {
        DocumentEntity hodDocument = officeDocument(
                UserRole.HOD,
                StudentDocumentCategory.APPLICATION_DOCUMENTS
        );
        DocumentEntity registrarDocument = officeDocument(
                UserRole.REGISTRAR,
                StudentDocumentCategory.APPLICATION_DOCUMENTS
        );

        assertTrue(accessService.canViewOfficeDocument(hodDocument, UserRole.HOD));
        assertFalse(accessService.canViewOfficeDocument(hodDocument, UserRole.REGISTRAR));
        assertTrue(accessService.canViewOfficeDocument(registrarDocument, UserRole.REGISTRAR));
        assertFalse(accessService.canViewOfficeDocument(registrarDocument, UserRole.HOD));
    }

    private DocumentEntity officeDocument(UserRole uploadedByRole, StudentDocumentCategory category) {
        DocumentEntity document = new DocumentEntity();
        document.setUploadedByRole(uploadedByRole);
        document.setCategory(category);
        document.setStatus(DocumentStatus.APPROVED);
        return document;
    }
}
