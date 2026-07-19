package com.auca.archive.service;

import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.dto.DocumentScanContext;
import com.auca.archive.dto.DocumentScanResponse;
import com.auca.archive.dto.UploadDocumentRequest;
import com.auca.archive.model.DocumentTemplateEntity;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class DocumentTemplateValidationService {
    private static final Pattern EMAIL_PATTERN = Pattern.compile("[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}");
    private static final Pattern PHONE_PATTERN = Pattern.compile("\\b\\d{3}[-.\\s]?\\d{3}[-.\\s]?\\d{3,4}\\b");
    private static final Pattern DATE_PATTERN = Pattern.compile("\\b\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}\\b");

    private final DocumentTemplateService templateService;
    private final DocumentTextExtractionService textExtractionService;
    private final DocumentKeywordValidationService keywordValidationService;

    public DocumentTemplateValidationService(
            DocumentTemplateService templateService,
            DocumentTextExtractionService textExtractionService,
            DocumentKeywordValidationService keywordValidationService
    ) {
        this.templateService = templateService;
        this.textExtractionService = textExtractionService;
        this.keywordValidationService = keywordValidationService;
    }

    public DocumentScanResponse validatePdf(byte[] fileBytes, DocumentScanContext context) throws IOException {
        DocumentTextExtractionService.ExtractionResult extraction = textExtractionService.extractFromPdf(fileBytes);
        StudentDocumentCategory category = parseCategory(context);

        DocumentTemplateEntity template = category == null
                ? null
                : templateService.findActiveTemplate(
                        category,
                        context == null ? null : context.office(),
                        context == null ? null : context.faculty(),
                        context == null ? null : context.department()
                ).orElse(null);

        if (template == null) {
            DocumentScanResponse fallback = keywordValidationService.validate(
                    extraction.text(),
                    context,
                    extraction.pageCount(),
                    extraction.scanMethod()
            );
            if (category == null) {
                return fallback;
            }
            List<String> signals = new ArrayList<>(fallback.matchedSignals() == null ? List.of() : fallback.matchedSignals());
            signals.add("No template configured for this category and office");
            return new DocumentScanResponse(
                    fallback.verified(),
                    fallback.summary() + " No official template is configured for this document category and office.",
                    signals,
                    fallback.pageCount(),
                    fallback.scanMethod(),
                    fallback.preview(),
                    null,
                    null,
                    null,
                    List.of("No template configured for this document category and office")
            );
        }

        ValidationOutcome outcome = compareAgainstTemplate(extraction.text(), template.getBaselineText(), context, template);
        String summary = outcome.verified()
                ? "Document matches the " + template.getTitle() + " template (" + outcome.similarityScore() + "% similarity)."
                : buildFailureSummary(template.getTitle(), outcome);

        return new DocumentScanResponse(
                outcome.verified(),
                summary,
                outcome.matchedSignals(),
                extraction.pageCount(),
                extraction.scanMethod(),
                textExtractionService.buildPreview(extraction.text()),
                outcome.similarityScore(),
                template.getTitle(),
                template.getId(),
                outcome.failedRules()
        );
    }

    public void requireVerified(byte[] fileBytes, UploadDocumentRequest request, String originalFileName, String office)
            throws IOException {
        DocumentScanContext context = new DocumentScanContext(
                request.studentNumber(),
                request.studentName(),
                request.category() == null ? null : request.category().name(),
                request.course(),
                request.faculty(),
                request.department(),
                originalFileName,
                request.documentSubtypeId(),
                office
        );
        DocumentScanResponse response = validatePdf(fileBytes, context);
        if (!response.verified()) {
            throw new IllegalArgumentException(response.summary());
        }
    }

    private StudentDocumentCategory parseCategory(DocumentScanContext context) {
        if (context == null || context.category() == null || context.category().isBlank()) {
            return null;
        }
        try {
            return StudentDocumentCategory.valueOf(context.category().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private ValidationOutcome compareAgainstTemplate(
            String submissionText,
            String baselineText,
            DocumentScanContext context,
            DocumentTemplateEntity template
    ) {
        Set<String> matchedSignals = new LinkedHashSet<>();
        List<String> failedRules = new ArrayList<>();

        String maskedSubmission = maskVariableFields(submissionText, context);
        String maskedBaseline = maskVariableFields(baselineText, context);
        int similarity = computeSimilarity(maskedBaseline, maskedSubmission);
        matchedSignals.add("Template similarity: " + similarity + "%");

        int threshold = template.getSimilarityThreshold() == null ? 80 : template.getSimilarityThreshold();
        if (similarity < threshold) {
            failedRules.add("Similarity " + similarity + "% below threshold " + threshold + "%");
        }

        if (submissionText.isBlank()) {
            failedRules.add("Could not extract readable text from the uploaded document");
        } else if (submissionText.length() < 20) {
            failedRules.add("Extracted text is too short to validate");
        }

        if (context != null) {
            String studentNumber = textExtractionService.normalizeToken(context.studentNumber());
            if (!studentNumber.isBlank()) {
                String normalizedSubmission = textExtractionService.normalizeToken(submissionText);
                if (normalizedSubmission.contains(studentNumber)) {
                    matchedSignals.add("Student ID matched: " + context.studentNumber().trim());
                } else {
                    failedRules.add("Student ID not found in document");
                }
            }
            if (containsStudentName(submissionText, context.studentName())) {
                matchedSignals.add("Student name matched: " + context.studentName().trim());
            }
        }

        boolean verified = failedRules.isEmpty();
        return new ValidationOutcome(verified, similarity, List.copyOf(matchedSignals), List.copyOf(failedRules));
    }

    private String buildFailureSummary(String templateTitle, ValidationOutcome outcome) {
        if (outcome.failedRules().isEmpty()) {
            return "Document could not be validated against " + templateTitle + ".";
        }
        return "Document failed validation against " + templateTitle + ": " + String.join("; ", outcome.failedRules()) + ".";
    }

    private String maskVariableFields(String text, DocumentScanContext context) {
        String masked = text == null ? "" : text;
        if (context != null) {
            if (context.studentNumber() != null && !context.studentNumber().isBlank()) {
                masked = masked.replace(context.studentNumber().trim().toLowerCase(Locale.ROOT), " ");
                masked = masked.replace(textExtractionService.normalizeToken(context.studentNumber()), " ");
            }
            if (context.studentName() != null && !context.studentName().isBlank()) {
                for (String part : context.studentName().trim().toLowerCase(Locale.ROOT).split("\\s+")) {
                    if (part.length() >= 3) {
                        masked = masked.replace(part, " ");
                    }
                }
            }
            if (context.course() != null && !context.course().isBlank()) {
                masked = masked.replace(context.course().trim().toLowerCase(Locale.ROOT), " ");
            }
        }
        masked = EMAIL_PATTERN.matcher(masked).replaceAll(" ");
        masked = PHONE_PATTERN.matcher(masked).replaceAll(" ");
        masked = DATE_PATTERN.matcher(masked).replaceAll(" ");
        return textExtractionService.normalize(masked);
    }

    private int computeSimilarity(String baseline, String submission) {
        if (baseline.isBlank() || submission.isBlank()) {
            return 0;
        }
        Set<String> baselineTokens = tokenSet(baseline);
        Set<String> submissionTokens = tokenSet(submission);
        if (baselineTokens.isEmpty() || submissionTokens.isEmpty()) {
            return 0;
        }
        Set<String> intersection = new HashSet<>(baselineTokens);
        intersection.retainAll(submissionTokens);
        Set<String> union = new HashSet<>(baselineTokens);
        union.addAll(submissionTokens);
        return Math.round((intersection.size() * 100f) / union.size());
    }

    private Set<String> tokenSet(String text) {
        return new HashSet<>(Arrays.asList(text.split("\\s+")));
    }

    private boolean containsStudentName(String text, String studentName) {
        if (studentName == null || studentName.isBlank()) {
            return false;
        }
        String normalizedText = textExtractionService.normalize(text);
        String[] parts = studentName.trim().toLowerCase(Locale.ROOT).split("\\s+");
        if (parts.length < 2) {
            return normalizedText.contains(textExtractionService.normalize(studentName));
        }
        int hits = 0;
        for (String part : parts) {
            if (part.length() >= 3 && normalizedText.contains(part)) {
                hits++;
            }
        }
        return hits >= 2;
    }

    private record ValidationOutcome(
            boolean verified,
            int similarityScore,
            List<String> matchedSignals,
            List<String> failedRules
    ) {
    }
}
