package com.auca.archive.service;



import com.auca.archive.dto.DocumentScanContext;

import com.auca.archive.dto.DocumentScanResponse;

import com.auca.archive.dto.UploadDocumentRequest;

import com.auca.archive.util.FileSignatureValidator;

import org.springframework.beans.factory.annotation.Value;

import org.springframework.stereotype.Service;

import org.springframework.web.multipart.MultipartFile;



import java.io.IOException;



@Service

public class DocumentScanService {

    private final boolean scanEnabled;

    private final DocumentTextExtractionService textExtractionService;

    private final DocumentKeywordValidationService keywordValidationService;

    private final DocumentTemplateValidationService templateValidationService;



    public DocumentScanService(

            @Value("${archive.document-scan.enabled:true}") boolean scanEnabled,

            DocumentTextExtractionService textExtractionService,

            DocumentKeywordValidationService keywordValidationService,

            DocumentTemplateValidationService templateValidationService

    ) {

        this.scanEnabled = scanEnabled;

        this.textExtractionService = textExtractionService;

        this.keywordValidationService = keywordValidationService;

        this.templateValidationService = templateValidationService;

    }



    public DocumentScanResponse scan(MultipartFile file, DocumentScanContext context) throws IOException {

        if (file == null || file.isEmpty()) {

            throw new IllegalArgumentException("Document file is required");

        }

        byte[] fileBytes = file.getBytes();

        FileSignatureValidator.requirePdf(fileBytes);

        DocumentScanContext enriched = enrichContext(context, file.getOriginalFilename());

        return scanPdf(fileBytes, enriched);

    }



    public DocumentScanResponse scanPdf(byte[] fileBytes, DocumentScanContext context) throws IOException {

        DocumentScanContext enriched = enrichContext(context, context == null ? null : context.fileName());

        if (enriched != null && enriched.category() != null && !enriched.category().isBlank()) {

            return templateValidationService.validatePdf(fileBytes, enriched);

        }

        DocumentTextExtractionService.ExtractionResult extraction = textExtractionService.extractFromPdf(fileBytes);

        return validateWithKeywordRules(extraction.text(), enriched, extraction.pageCount(), extraction.scanMethod());

    }



    public DocumentScanResponse validateWithKeywordRules(

            String text,

            DocumentScanContext context,

            int pageCount,

            String scanMethod

    ) {

        return keywordValidationService.validate(text, context, pageCount, scanMethod);

    }



    public void requireVerified(

            byte[] fileBytes,

            UploadDocumentRequest request,

            String originalFileName,

            String office

    ) throws IOException {

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

                originalFileName,

                request.documentSubtypeId(),

                office

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

            return new DocumentScanContext(null, null, null, null, null, null, resolvedFileName, null, null);

        }

        return new DocumentScanContext(

                context.studentNumber(),

                context.studentName(),

                context.category(),

                context.course(),

                context.faculty(),

                context.department(),

                resolvedFileName,

                context.documentSubtypeId(),

                context.office()

        );

    }

}


