package com.auca.archive.service;

import com.auca.archive.dto.DocumentScanContext;
import com.auca.archive.dto.DocumentScanResponse;
import com.auca.archive.util.FileSignatureValidator;
import com.auca.archive.dto.UploadDocumentRequest;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class DocumentScanService {
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9]+");
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

    private final boolean scanEnabled;
    private final int minTextCharsBeforeOcr;
    private final int maxOcrPages;
    private final float ocrDpi;
    private final String tessDataPath;
    private final boolean ocrEnabled;
    private final MalwareScanService malwareScanService;

    public DocumentScanService(
            @Value("${archive.document-scan.enabled:true}") boolean scanEnabled,
            @Value("${archive.document-scan.min-text-chars:60}") int minTextCharsBeforeOcr,
            @Value("${archive.document-scan.max-ocr-pages:10}") int maxOcrPages,
            @Value("${archive.document-scan.ocr-dpi:150}") float ocrDpi,
            @Value("${archive.ocr.enabled:true}") boolean ocrEnabled,
            @Value("${archive.ocr.tessdata-path:}") String tessDataPath,
            MalwareScanService malwareScanService
    ) {
        this.scanEnabled = scanEnabled;
        this.minTextCharsBeforeOcr = minTextCharsBeforeOcr;
        this.maxOcrPages = maxOcrPages;
        this.ocrDpi = ocrDpi;
        this.ocrEnabled = ocrEnabled;
        this.tessDataPath = tessDataPath == null ? "" : tessDataPath.trim();
        this.malwareScanService = malwareScanService;
    }

    public DocumentScanResponse scan(MultipartFile file, DocumentScanContext context) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Document file is required");
        }

        byte[] fileBytes = file.getBytes();
        MalwareScanService.ScanResult malwareResult = malwareScanService.scan(fileBytes, file.getOriginalFilename());
        if (!malwareResult.clean()) {
            return new DocumentScanResponse(
                    false,
                    malwareResult.message(),
                    List.of("MALWARE"),
                    0,
                    "MALWARE",
                    "",
                    false,
                    malwareResult.message()
            );
        }
        FileSignatureValidator.requirePdf(fileBytes);
        DocumentScanContext enriched = enrichContext(context, file.getOriginalFilename());
        return scanPdf(fileBytes, enriched, malwareResult);
    }

    public DocumentScanResponse scanPdf(byte[] fileBytes, DocumentScanContext context) throws IOException {
        return scanPdf(fileBytes, context, null);
    }

    private DocumentScanResponse scanPdf(
            byte[] fileBytes,
            DocumentScanContext context,
            MalwareScanService.ScanResult malwareResult
    ) throws IOException {
        DocumentScanContext enriched = enrichContext(context, context == null ? null : context.fileName());
        try (PDDocument document = PDDocument.load(fileBytes)) {
            int pageCount = document.getNumberOfPages();
            String extractedText = extractText(document);
            String scanMethod = "TEXT";

            if (extractedText.length() < minTextCharsBeforeOcr) {
                String ocrText = runOcr(document);
                if (!ocrText.isBlank()) {
                    extractedText = (extractedText + " " + ocrText).trim();
                    scanMethod = extractedText.isBlank() ? "OCR" : "TEXT+OCR";
                } else if (extractedText.isBlank()) {
                    scanMethod = "NONE";
                }
            }

            ScanEvaluation evaluation = evaluate(extractedText, enriched);
            String preview = buildPreview(extractedText);
            String summary = evaluation.verified()
                    ? "This file looks like a valid AUCA archive document."
                    : buildRejectionSummary(extractedText, evaluation);

            boolean malwarePassed = malwareResult != null && malwareResult.clean();
            String malwareSummary = malwareResult == null ? "" : malwareResult.message();

            return new DocumentScanResponse(
                    evaluation.verified(),
                    summary,
                    evaluation.matchedSignals(),
                    pageCount,
                    scanMethod,
                    preview,
                    malwarePassed,
                    malwareSummary
            );
        }
    }

    public void requireVerified(byte[] fileBytes, UploadDocumentRequest request, String originalFileName) throws IOException {
        malwareScanService.requireClean(fileBytes, originalFileName);
        if (!scanEnabled) {
            return;
        }

        DocumentScanContext context = enrichContext(new DocumentScanContext(
                request.studentNumber(),
                request.studentName(),
                request.category() == null ? null : request.category().name(),
                request.course(),
                request.faculty(),
                request.department(),
                originalFileName
        ), originalFileName);

        DocumentScanResponse scan = scanPdf(fileBytes, context);
        if (!scan.verified()) {
            throw new IllegalArgumentException(scan.summary());
        }
    }

    private DocumentScanContext enrichContext(DocumentScanContext context, String fileName) {
        String resolvedFileName = fileName;
        if (context != null && context.fileName() != null && !context.fileName().isBlank()) {
            resolvedFileName = context.fileName();
        }
        if (context == null) {
            return new DocumentScanContext(
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    resolvedFileName
            );
        }
        return new DocumentScanContext(
                context.studentNumber(),
                context.studentName(),
                context.category(),
                context.course(),
                context.faculty(),
                context.department(),
                resolvedFileName
        );
    }

    private String extractText(PDDocument document) throws IOException {
        PDFTextStripper stripper = new PDFTextStripper();
        stripper.setSortByPosition(true);
        return normalize(document.getNumberOfPages() == 0 ? "" : stripper.getText(document));
    }

    private String runOcr(PDDocument document) {
        if (!ocrEnabled) {
            return "";
        }

        try {
            Tesseract tesseract = createTesseract();
            if (tesseract == null) {
                return "";
            }

            PDFRenderer renderer = new PDFRenderer(document);
            int pages = Math.min(document.getNumberOfPages(), maxOcrPages);
            StringBuilder builder = new StringBuilder();

            for (int pageIndex = 0; pageIndex < pages; pageIndex++) {
                var image = renderer.renderImageWithDPI(pageIndex, ocrDpi);
                String pageText = tesseract.doOCR(image);
                if (pageText != null && !pageText.isBlank()) {
                    builder.append(' ').append(pageText);
                }
            }

            return normalize(builder.toString());
        } catch (IOException | TesseractException ex) {
            return "";
        }
    }

    private Tesseract createTesseract() {
        try {
            Tesseract tesseract = new Tesseract();
            if (!tessDataPath.isBlank()) {
                tesseract.setDatapath(tessDataPath);
            }
            tesseract.setLanguage("eng");
            return tesseract;
        } catch (Exception ex) {
            return null;
        }
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
            String studentNumber = normalizeToken(context.studentNumber());
            if (!studentNumber.isBlank()
                    && (text.contains(studentNumber) || normalizeToken(text).contains(studentNumber))) {
                matchedSignals.add("Student ID matched: " + context.studentNumber().trim());
                score += 4;
            }

            if (containsStudentName(text, context.studentName())) {
                matchedSignals.add("Student name matched: " + context.studentName().trim());
                score += 3;
            }

            String course = normalize(textValue(context.course()));
            if (!course.isBlank() && text.contains(course)) {
                matchedSignals.add("Course matched: " + context.course().trim());
                score += 2;
            }

            String faculty = normalize(textValue(context.faculty()));
            if (!faculty.isBlank() && text.contains(faculty)) {
                matchedSignals.add("Faculty matched: " + context.faculty().trim());
                score += 2;
            }

            String department = normalize(textValue(context.department()));
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
            return text.contains(normalize(studentName));
        }

        int hits = 0;
        for (String part : parts) {
            if (part.length() >= 3 && text.contains(part)) {
                hits++;
            }
        }
        return hits >= 2;
    }

    private String buildPreview(String text) {
        if (text.isBlank()) {
            return "";
        }
        String compact = text.replaceAll("\\s+", " ").trim();
        return compact.length() <= 220 ? compact : compact.substring(0, 217) + "...";
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

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private String normalizeToken(String value) {
        if (value == null) {
            return "";
        }
        return NON_ALPHANUMERIC.matcher(value.toLowerCase(Locale.ROOT)).replaceAll("");
    }

    private String textValue(String value) {
        return value == null ? "" : value;
    }

    private record ScanEvaluation(boolean verified, List<String> matchedSignals) {
    }
}
