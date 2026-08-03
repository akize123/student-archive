package com.auca.archive.service;

import com.auca.archive.dto.DocumentScanContext;
import com.auca.archive.dto.DocumentScanResponse;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class DocumentKeywordValidationService {
    private static final List<String> STRONG_AUCA_MARKERS = List.of(
            "auca",
            "adventist university of central africa",
            "adventist university",
            "auca.ac.rw",
            "www.auca.ac.rw"
    );
    private static final List<String> WEAK_AUCA_MARKERS = List.of(
            "registrar",
            "registration",
            "examination",
            "transcript",
            "kigali",
            "rwanda",
            "faculty",
            "semester",
            "student",
            "admission",
            "enrollment",
            "reintegration",
            "graduate",
            "diploma",
            "bachelor",
            "mid-sem",
            "final exam"
    );

    private final DocumentTextExtractionService textExtractionService;

    public DocumentKeywordValidationService(DocumentTextExtractionService textExtractionService) {
        this.textExtractionService = textExtractionService;
    }

    public DocumentScanResponse validate(String text, DocumentScanContext context, int pageCount, String scanMethod) {
        ScanEvaluation evaluation = evaluate(text, context);
        String preview = textExtractionService.buildPreview(text);
        String summary = evaluation.verified()
                ? "This file looks like a valid AUCA archive document."
                : buildRejectionSummary(text, evaluation);
        return new DocumentScanResponse(
                evaluation.verified(),
                summary,
                evaluation.matchedSignals(),
                pageCount,
                scanMethod,
                preview
        );
    }

    private ScanEvaluation evaluate(String text, DocumentScanContext context) {
        Set<String> matchedSignals = new LinkedHashSet<>();
        int score = 0;

        for (String marker : STRONG_AUCA_MARKERS) {
            if (text.contains(marker)) {
                matchedSignals.add("AUCA reference: " + marker);
                score += 3;
            }
        }

        for (String marker : WEAK_AUCA_MARKERS) {
            if (text.contains(marker)) {
                matchedSignals.add("Archive keyword: " + marker);
                score += 1;
            }
        }

        if (context != null) {
            String studentNumber = textExtractionService.normalizeToken(context.studentNumber());
            if (!studentNumber.isBlank()
                    && (text.contains(studentNumber) || textExtractionService.normalizeToken(text).contains(studentNumber))) {
                matchedSignals.add("Student ID matched: " + context.studentNumber().trim());
                score += 4;
            }

            if (containsStudentName(text, context.studentName())) {
                matchedSignals.add("Student name matched: " + context.studentName().trim());
                score += 3;
            }

            String course = textExtractionService.normalize(textValue(context.course()));
            if (!course.isBlank() && text.contains(course)) {
                matchedSignals.add("Course matched: " + context.course().trim());
                score += 2;
            }

            String faculty = textExtractionService.normalize(textValue(context.faculty()));
            if (!faculty.isBlank() && text.contains(faculty)) {
                matchedSignals.add("Faculty matched: " + context.faculty().trim());
                score += 2;
            }

            String department = textExtractionService.normalize(textValue(context.department()));
            if (!department.isBlank() && text.contains(department)) {
                matchedSignals.add("Department matched: " + context.department().trim());
                score += 2;
            }
        }

        boolean hasStrongAucaMarker = matchedSignals.stream().anyMatch(signal -> signal.startsWith("AUCA reference"));
        boolean hasStudentMatch = matchedSignals.stream().anyMatch(signal -> signal.startsWith("Student"));
        boolean isFinalYearProject = context != null
                && "FINAL_YEAR_PROJECT".equalsIgnoreCase(String.valueOf(context.category()));
        boolean verified = isFinalYearProject
                ? !text.isBlank() && text.length() >= 20
                : !text.isBlank() && (hasStrongAucaMarker || hasStudentMatch || score >= 4);

        return new ScanEvaluation(verified, List.copyOf(matchedSignals));
    }

    private boolean containsStudentName(String text, String studentName) {
        if (studentName == null || studentName.isBlank()) {
            return false;
        }
        String[] parts = studentName.trim().toLowerCase(Locale.ROOT).split("\\s+");
        if (parts.length < 2) {
            return text.contains(textExtractionService.normalize(studentName));
        }
        int hits = 0;
        for (String part : parts) {
            if (part.length() >= 3 && text.contains(part)) {
                hits++;
            }
        }
        return hits >= 2;
    }

    private String buildRejectionSummary(String text, ScanEvaluation evaluation) {
        if (text.isBlank()) {
            return "We could not read any AUCA-related text from this PDF. Upload a searchable PDF or a clear scan with AUCA letterhead and student details.";
        }
        if (evaluation.matchedSignals().isEmpty()) {
            return "This document does not appear to be an AUCA archive record. It must include AUCA branding or match the student details you entered.";
        }
        return "This document could not be confirmed as an AUCA archive record. Check that the file includes AUCA letterhead and the correct student information.";
    }

    private String textValue(String value) {
        return value == null ? "" : value;
    }

    private record ScanEvaluation(boolean verified, List<String> matchedSignals) {
    }
}
