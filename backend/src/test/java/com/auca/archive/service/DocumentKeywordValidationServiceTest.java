package com.auca.archive.service;

import com.auca.archive.dto.DocumentScanContext;
import com.auca.archive.dto.DocumentScanResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DocumentKeywordValidationServiceTest {
    private DocumentKeywordValidationService validationService;

    @BeforeEach
    void setUp() {
        DocumentTextExtractionService textExtractionService = mock(DocumentTextExtractionService.class);
        when(textExtractionService.normalize(anyString())).thenAnswer(invocation -> {
            String value = invocation.getArgument(0, String.class);
            return value == null ? "" : value.toLowerCase();
        });
        when(textExtractionService.normalizeToken(anyString())).thenAnswer(invocation -> {
            String value = invocation.getArgument(0, String.class);
            return value == null ? "" : value.toLowerCase().replaceAll("[^a-z0-9]", "");
        });
        when(textExtractionService.buildPreview(anyString())).thenAnswer(invocation -> {
            String value = invocation.getArgument(0, String.class);
            if (value == null || value.length() <= 120) {
                return value;
            }
            return value.substring(0, 117) + "...";
        });
        validationService = new DocumentKeywordValidationService(textExtractionService);
    }

    @Test
    void acceptsAucaLetterheadDocument() {
        String text = """
                Adventist University of Central Africa
                Registrar Office
                Student ID: 26889
                Name: Iyamukuza Aline
                Registration Form
                """;

        DocumentScanResponse response = validationService.validate(
                text.toLowerCase(),
                new DocumentScanContext("26889", "Iyamukuza Aline", null, null, null, null, "registration.pdf"),
                1,
                "text-layer"
        );

        assertTrue(response.verified());
    }

    @Test
    void rejectsUnrelatedDocument() {
        String text = "Generic invoice for office supplies with no university branding.";

        DocumentScanResponse response = validationService.validate(
                text.toLowerCase(),
                new DocumentScanContext("26889", "Iyamukuza Aline", null, null, null, null, "invoice.pdf"),
                1,
                "text-layer"
        );

        assertFalse(response.verified());
    }

    @Test
    void acceptsDocumentWithStudentMatchEvenWithoutStrongBranding() {
        String text = """
                Registration office
                Student record for semester 2024/1
                Student ID 26889
                Name Iyamukuza Aline
                """;

        DocumentScanResponse response = validationService.validate(
                text.toLowerCase(),
                new DocumentScanContext("26889", "Iyamukuza Aline", null, null, null, null, "record.pdf"),
                1,
                "text-layer"
        );

        assertTrue(response.verified());
    }
}
