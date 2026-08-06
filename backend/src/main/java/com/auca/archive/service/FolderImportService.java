package com.auca.archive.service;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.domain.DocumentType;
import com.auca.archive.domain.SharePermission;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.util.FileSignatureValidator;
import com.auca.archive.dto.ActivityScope;
import com.auca.archive.dto.RequestActor;
import com.auca.archive.dto.DocumentScanContext;
import com.auca.archive.dto.DocumentScanResponse;
import com.auca.archive.dto.ImportCommitMappingRequest;
import com.auca.archive.dto.ImportCommitRequest;
import com.auca.archive.dto.ImportPreviewItemResponse;
import com.auca.archive.dto.ImportPreviewResponse;
import com.auca.archive.dto.FolderImportResponse;
import com.auca.archive.dto.FolderNodeResponse;
import com.auca.archive.model.DocumentEntity;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.model.StudentEntity;
import com.auca.archive.repository.DocumentRepository;
import com.auca.archive.repository.FolderRepository;
import jakarta.transaction.Transactional;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
public class FolderImportService {
    private static final long MIN_FILE_BYTES = 1024L;

    private final FolderService folderService;
    private final FolderRepository folderRepository;
    private final DocumentRepository documentRepository;
    private final ArchiveAccessService accessService;
    private final StudentService studentService;
    private final StudentEnrollmentService studentEnrollmentService;
    private final StudentIdFormatService studentIdFormatService;
    private final FileEncryptionService fileEncryptionService;
    private final ActivityService activityService;
    private final ImportPathResolutionService importPathResolutionService;
    private final DocumentTemplateValidationService templateValidationService;
    private final DocumentScanService documentScanService;
    private final ArchiveTreeService archiveTreeService;
    private final AcademicTermService academicTermService;
    private final DocumentChecksumService checksumService;
    private final PdfOptimizationService pdfOptimizationService;
    private final ArchiveStoragePaths archiveStoragePaths;
    private final Path storageRoot;
    private final long maxUploadSizeBytes;

    public FolderImportService(
            FolderService folderService,
            FolderRepository folderRepository,
            DocumentRepository documentRepository,
            ArchiveAccessService accessService,
            StudentService studentService,
            StudentEnrollmentService studentEnrollmentService,
            StudentIdFormatService studentIdFormatService,
            FileEncryptionService fileEncryptionService,
            ActivityService activityService,
            ImportPathResolutionService importPathResolutionService,
            DocumentTemplateValidationService templateValidationService,
            DocumentScanService documentScanService,
            ArchiveTreeService archiveTreeService,
            AcademicTermService academicTermService,
            DocumentChecksumService checksumService,
            PdfOptimizationService pdfOptimizationService,
            ArchiveStoragePaths archiveStoragePaths,
            @Value("${archive.max-upload-size-bytes:10485760}") long maxUploadSizeBytes
    ) {
        this.folderService = folderService;
        this.folderRepository = folderRepository;
        this.documentRepository = documentRepository;
        this.accessService = accessService;
        this.studentService = studentService;
        this.studentEnrollmentService = studentEnrollmentService;
        this.studentIdFormatService = studentIdFormatService;
        this.fileEncryptionService = fileEncryptionService;
        this.activityService = activityService;
        this.importPathResolutionService = importPathResolutionService;
        this.templateValidationService = templateValidationService;
        this.documentScanService = documentScanService;
        this.archiveTreeService = archiveTreeService;
        this.academicTermService = academicTermService;
        this.checksumService = checksumService;
        this.pdfOptimizationService = pdfOptimizationService;
        this.archiveStoragePaths = archiveStoragePaths;
        this.storageRoot = archiveStoragePaths.storageRoot();
        this.maxUploadSizeBytes = maxUploadSizeBytes;
    }

    @Transactional
    public FolderImportResponse importIntoFolder(
            Long folderId,
            MultipartFile archive,
            List<MultipartFile> files,
            List<String> paths,
            String rawRole,
            String rawUserName
    ) throws IOException {
        return importIntoFolder(folderId, archive, files, paths, rawRole, rawUserName, RequestActor.empty());
    }

    @Transactional
    public FolderImportResponse importIntoFolder(
            Long folderId,
            MultipartFile archive,
            List<MultipartFile> files,
            List<String> paths,
            String rawRole,
            String rawUserName,
            RequestActor requestActor
    ) throws IOException {
        return importIntoFolder(folderId, archive, files, paths, rawRole, rawUserName, requestActor, null);
    }

    @Transactional
    public FolderImportResponse importIntoFolder(
            Long folderId,
            MultipartFile archive,
            List<MultipartFile> files,
            List<String> paths,
            String rawRole,
            String rawUserName,
            RequestActor requestActor,
            String rawViewerDepartment
    ) throws IOException {
        UserRole role = accessService.resolveRole(rawRole);
        String viewerDepartment = accessService.normalizeViewerDepartment(rawViewerDepartment);
        accessService.requireScopedViewerAssignment(role, viewerDepartment);
        requireImportRole(role);

        FolderEntity targetFolder = folderService.getFolderOrThrow(folderId);
        folderService.requireScopedFolderPlacement(targetFolder, role, viewerDepartment);
        folderService.requireShareAtLeast(targetFolder, role, null, SharePermission.WRITE);
        if (!isSemesterOrDeeperFolder(targetFolder)) {
            throw new IllegalArgumentException("Open a semester folder or deeper before importing files.");
        }

        List<ImportCandidate> candidates = new ArrayList<>();
        if (archive != null && !archive.isEmpty()) {
            byte[] archiveBytes = archive.getBytes();
            if (!ZipBombGuard.looksLikeZip(archiveBytes, archive.getOriginalFilename(), archive.getContentType())) {
                throw new IllegalArgumentException("Only ZIP archives are supported for import.");
            }
            for (ZipBombGuard.ExtractedEntry entry : ZipBombGuard.extractSafe(archiveBytes)) {
                candidates.add(new ImportCandidate(entry.relativePath(), entry.bytes()));
            }
        } else if (files != null && !files.isEmpty()) {
            if (paths == null || paths.size() != files.size()) {
                throw new IllegalArgumentException("Folder import requires a path for each selected file.");
            }
            for (int index = 0; index < files.size(); index += 1) {
                MultipartFile file = files.get(index);
                if (file == null || file.isEmpty()) {
                    continue;
                }
                String relativePath = ZipBombGuard.sanitizeFolderRelativePath(ZipBombGuard.decodePath(paths.get(index)));
                if (relativePath == null) {
                    continue;
                }
                String lowerName = relativePath.toLowerCase(Locale.ROOT);
                if (lowerName.endsWith(".zip") || lowerName.endsWith(".jar") || lowerName.endsWith(".7z")) {
                    throw new IllegalArgumentException("Nested archives are not allowed in folder imports.");
                }
                candidates.add(new ImportCandidate(relativePath, file.getBytes()));
            }
        } else {
            throw new IllegalArgumentException("Choose a ZIP archive or a folder to import.");
        }

        if (candidates.isEmpty()) {
            throw new IllegalArgumentException("No importable files were found.");
        }

        String uploadedBy = rawUserName == null || rawUserName.isBlank() ? role.name() : rawUserName.trim();
        StudentDocumentCategory category = defaultCategoryForRole(role);
        ImportPathResolutionService.ArchiveFolderContext folderContext =
                importPathResolutionService.resolveFolderContext(targetFolder);
        Map<String, Long> folderCache = new HashMap<>();
        List<String> importedFiles = new ArrayList<>();
        List<String> skippedFiles = new ArrayList<>();
        List<String> messages = new ArrayList<>();
        int folderCount = 0;
        java.util.LinkedHashSet<Long> targetFolderIds = new java.util.LinkedHashSet<>();

        for (ImportCandidate candidate : candidates) {
            if (!FileSignatureValidator.isPdf(candidate.bytes())) {
                skippedFiles.add(candidate.relativePath());
                messages.add("Skipped non-PDF file: " + candidate.relativePath());
                continue;
            }
            try {
                ResolvedTarget resolvedTarget = resolveTargetFolder(
                        targetFolder,
                        candidate.relativePath(),
                        role,
                        folderCache
                );
                folderCount = Math.max(folderCount, resolvedTarget.createdFolders());
                targetFolderIds.add(resolvedTarget.folder().getId());
                importPdf(
                        resolvedTarget.folder(),
                        candidate.fileName(),
                        candidate.bytes(),
                        resolvedTarget.studentNumber(),
                        resolvedTarget.studentNumber(),
                        category,
                        null,
                        null,
                        uploadedBy,
                        role,
                        folderContext.faculty(),
                        folderContext.department(),
                        folderContext.academicYear(),
                        folderContext.semester(),
                        null,
                        null,
                        category.getDisplayName(),
                        viewerDepartment
                );
                importedFiles.add(candidate.relativePath());
            } catch (IllegalArgumentException ex) {
                skippedFiles.add(candidate.relativePath());
                messages.add(ex.getMessage() + " (" + candidate.relativePath() + ")");
            }
        }

        if (importedFiles.isEmpty()) {
            throw new IllegalArgumentException(messages.isEmpty()
                    ? "No PDF files could be imported."
                    : String.join(" ", messages));
        }

        activityService.recordAction(
                "Imported " + importedFiles.size() + " file(s) into \"" + targetFolder.getName() + "\"",
                uploadedBy,
                ActivityCategory.UPLOAD,
                activityService.enrichScope(ActivityScope.builder()
                        .sourceRole(role)
                        .documentCategory(category)
                        .academicDepartment(folderService.resolveAcademicDepartmentFromFolderId(targetFolder.getId()))
                        .build(), requestActor),
                requestActor
        );

        return new FolderImportResponse(
                importedFiles.size(),
                skippedFiles.size(),
                folderCount,
                importedFiles,
                skippedFiles,
                messages,
                List.copyOf(targetFolderIds)
        );
    }

    public ImportPreviewResponse previewImport(
            Long folderId,
            MultipartFile archive,
            List<MultipartFile> files,
            List<String> paths,
            String rawRole,
            StudentDocumentCategory defaultCategory,
            Long defaultSubtypeId
    ) throws IOException {
        return previewImport(folderId, archive, files, paths, rawRole, defaultCategory, defaultSubtypeId, null);
    }

    public ImportPreviewResponse previewImport(
            Long folderId,
            MultipartFile archive,
            List<MultipartFile> files,
            List<String> paths,
            String rawRole,
            StudentDocumentCategory defaultCategory,
            Long defaultSubtypeId,
            String rawViewerDepartment
    ) throws IOException {
        return previewImport(
                folderId,
                archive,
                files,
                paths,
                rawRole,
                defaultCategory,
                defaultSubtypeId,
                rawViewerDepartment,
                null
        );
    }

    public ImportPreviewResponse previewImport(
            Long folderId,
            MultipartFile archive,
            List<MultipartFile> files,
            List<String> paths,
            String rawRole,
            StudentDocumentCategory defaultCategory,
            Long defaultSubtypeId,
            String rawViewerDepartment,
            String linkedStudentNumberParam
    ) throws IOException {
        UserRole role = accessService.resolveRole(rawRole);
        String viewerDepartment = accessService.normalizeViewerDepartment(rawViewerDepartment);
        accessService.requireScopedViewerAssignment(role, viewerDepartment);
        requireImportRole(role);
        FolderEntity targetFolder = folderService.getFolderOrThrow(folderId);
        folderService.requireScopedFolderPlacement(targetFolder, role, viewerDepartment);
        if (!isSemesterOrDeeperFolder(targetFolder)) {
            throw new IllegalArgumentException("Open a semester folder or deeper before importing files.");
        }

        List<ImportCandidate> candidates = collectCandidates(archive, files, paths);
        Map<String, byte[]> candidateBytes = new LinkedHashMap<>();
        for (ImportCandidate candidate : candidates) {
            candidateBytes.put(candidate.relativePath(), candidate.bytes());
        }
        ImportPathResolutionService.ArchiveFolderContext context = importPathResolutionService.resolveFolderContext(targetFolder);
        StudentDocumentCategory category = defaultCategory == null ? defaultCategoryForRole(role) : defaultCategory;

        List<ImportPreviewItemResponse> items = new ArrayList<>();
        List<String> messages = new ArrayList<>();
        int skippedCount = 0;
        List<com.auca.archive.dto.ZipAuditEntryResponse> zipAudit = List.of();
        if (archive != null && !archive.isEmpty()) {
            zipAudit = ZipBombGuard.auditArchive(archive.getBytes()).stream()
                    .map(entry -> new com.auca.archive.dto.ZipAuditEntryResponse(
                            entry.relativePath(),
                            entry.sizeBytes(),
                            entry.action(),
                            entry.note()
                    ))
                    .toList();
        }

        for (ImportCandidate candidate : candidates) {
            ImportPreviewItemResponse item = importPathResolutionService.resolveItem(
                    candidate.relativePath(),
                    candidate.fileName(),
                    targetFolder,
                    context.faculty(),
                    context.department(),
                    context.academicYear(),
                    context.semester(),
                    FileSignatureValidator.isPdf(candidate.bytes()) ? candidate.bytes() : null
            );
            if (!FileSignatureValidator.isPdf(candidate.bytes())) {
                skippedCount += 1;
                messages.add("Skipped non-PDF file: " + candidate.relativePath());
                items.add(markNonImportablePreviewItem(item, candidate.bytes()));
                continue;
            }
            items.add(item);
        }

        boolean insideStudentTree = folderService.isWithinSemesterStudentTree(targetFolder);
        String linkedStudentNumber = insideStudentTree
                ? folderService.resolveSemesterStudentNumber(targetFolder).orElse("")
                : linkedStudentNumberParam == null ? "" : linkedStudentNumberParam.trim().toUpperCase(Locale.ROOT);
        if (!linkedStudentNumber.isBlank()) {
            List<ImportPreviewItemResponse> linkedItems = new ArrayList<>();
            for (ImportPreviewItemResponse item : items) {
                linkedItems.add(applyLinkedStudentPreview(item, linkedStudentNumber));
            }
            items = linkedItems;
        }
        String linkedStudentName = resolveImportStudentName(linkedStudentNumber, null, true);

        List<ImportPreviewItemResponse> scannedItems = new ArrayList<>();
        for (ImportPreviewItemResponse item : items) {
            if (!item.importable()) {
                scannedItems.add(item);
                continue;
            }
            byte[] pdfBytes = candidateBytes.get(item.originalPath());
            scannedItems.add(enrichItemWithDocumentScan(
                    item,
                    pdfBytes,
                    category,
                    context,
                    role,
                    linkedStudentName
            ));
        }
        items = scannedItems;

        int importableCount = (int) items.stream().filter(ImportPreviewItemResponse::importable).count();
        return new ImportPreviewResponse(
                candidates.size(),
                importableCount,
                skippedCount,
                category,
                defaultSubtypeId,
                items,
                messages,
                zipAudit,
                insideStudentTree,
                linkedStudentNumber.isBlank() ? null : linkedStudentNumber,
                linkedStudentName,
                insideStudentTree ? targetFolder.getId() : null
        );
    }

    @Transactional
    public FolderImportResponse commitImport(
            Long folderId,
            ImportCommitRequest request,
            Map<String, byte[]> fileContents,
            String rawRole,
            String rawUserName,
            RequestActor requestActor
    ) throws IOException {
        return commitImport(folderId, request, fileContents, rawRole, rawUserName, requestActor, null);
    }

    @Transactional
    public FolderImportResponse commitImport(
            Long folderId,
            ImportCommitRequest request,
            Map<String, byte[]> fileContents,
            String rawRole,
            String rawUserName,
            RequestActor requestActor,
            String rawViewerDepartment
    ) throws IOException {
        UserRole role = accessService.resolveRole(rawRole);
        String viewerDepartment = accessService.normalizeViewerDepartment(rawViewerDepartment);
        accessService.requireScopedViewerAssignment(role, viewerDepartment);
        requireImportRole(role);
        FolderEntity targetFolder = folderService.getFolderOrThrow(folderId);
        folderService.requireScopedFolderPlacement(targetFolder, role, viewerDepartment);
        folderService.requireShareAtLeast(targetFolder, role, null, SharePermission.WRITE);
        if (!isSemesterOrDeeperFolder(targetFolder)) {
            throw new IllegalArgumentException("Open a semester folder or deeper before importing files.");
        }

        String uploadedBy = rawUserName == null || rawUserName.isBlank() ? role.name() : rawUserName.trim();
        ImportPathResolutionService.ArchiveFolderContext context = importPathResolutionService.resolveFolderContext(targetFolder);
        LinkedImportContext linkedImport = resolveLinkedImportContext(targetFolder, request, context, role, viewerDepartment);
        Map<String, Long> folderCache = new HashMap<>();
        List<String> importedFiles = new ArrayList<>();
        List<String> skippedFiles = new ArrayList<>();
        List<String> messages = new ArrayList<>();
        int folderCount = 0;
        java.util.LinkedHashSet<Long> targetFolderIds = new java.util.LinkedHashSet<>();

        for (ImportCommitMappingRequest mapping : request.mappings()) {
            byte[] fileBytes = fileContents.get(mapping.originalPath());
            if (fileBytes == null) {
                skippedFiles.add(mapping.originalPath());
                messages.add("Missing file content for " + mapping.originalPath());
                continue;
            }
            if (!FileSignatureValidator.isPdf(fileBytes)) {
                skippedFiles.add(mapping.originalPath());
                messages.add("Skipped non-PDF file: " + mapping.originalPath());
                continue;
            }

            String targetFolderName = linkedImport.studentNumber();
            if (request.linkLegacy() && studentIdFormatService.isLegacyFormat(targetFolderName)) {
                studentService.findByStudentNumber(targetFolderName)
                        .orElseThrow(() -> new IllegalArgumentException(
                                "Legacy student folder \"" + targetFolderName + "\" does not match an existing student record."
                        ));
            } else {
                studentIdFormatService.requireStaffFolderName(targetFolderName);
            }
            List<String> conflicts = studentService.detectConflicts(
                    targetFolderName,
                    linkedImport.studentName(),
                    context.faculty(),
                    context.department(),
                    true
            );
            if (!conflicts.isEmpty()) {
                skippedFiles.add(mapping.originalPath());
                messages.add(String.join(" ", conflicts) + " (" + mapping.originalPath() + ")");
                continue;
            }

            StudentDocumentCategory validationCategory = mapping.category() == null
                    ? request.defaultCategory()
                    : mapping.category();
            try {
                requireImportDocumentVerified(
                        fileBytes,
                        linkedImport.studentNumber(),
                        linkedImport.studentName(),
                        validationCategory,
                        context.faculty(),
                        context.department(),
                        mapping.originalPath(),
                        role,
                        linkedImport.insideStudentTree()
                );
            } catch (IllegalArgumentException ex) {
                skippedFiles.add(mapping.originalPath());
                messages.add(ex.getMessage());
                continue;
            }
            if (request.validateTemplates() && validationCategory != null) {
                try {
                    var scan = templateValidationService.validatePdf(
                            fileBytes,
                            new com.auca.archive.dto.DocumentScanContext(
                                    targetFolderName,
                                    linkedImport.studentName(),
                                    validationCategory.name(),
                                    null,
                                    context.faculty(),
                                    context.department(),
                                    mapping.originalPath(),
                                    null,
                                    role.getDepartment()
                            )
                    );
                    if (!scan.verified()) {
                        skippedFiles.add(mapping.originalPath());
                        messages.add(scan.summary() + " (" + mapping.originalPath() + ")");
                        continue;
                    }
                } catch (IOException ex) {
                    skippedFiles.add(mapping.originalPath());
                    messages.add("Validation failed for " + mapping.originalPath());
                    continue;
                }
            }

            try {
                StudentDocumentCategory category = mapping.category() == null
                        ? (request.defaultCategory() == null ? defaultCategoryForRole(role) : request.defaultCategory())
                        : mapping.category();
                String registrarSubfolderName = mapping.title() != null && !mapping.title().isBlank()
                        ? mapping.title().trim()
                        : "";
                if (registrarSubfolderName.isBlank()) {
                    skippedFiles.add(mapping.originalPath());
                    messages.add("Document type is required for " + mapping.originalPath()
                            + ". Choose a document type during import — it becomes the subfolder name.");
                    continue;
                }
                String primaryDocumentType = mapping.documentTypeLabel() != null && !mapping.documentTypeLabel().isBlank()
                        ? mapping.documentTypeLabel().trim()
                        : category.getDisplayName();
                String documentAcademicYear = mapping.academicYear();
                String documentSemester = mapping.semester();
                if (documentAcademicYear == null || documentAcademicYear.isBlank()
                        || documentSemester == null || documentSemester.isBlank()) {
                    skippedFiles.add(mapping.originalPath());
                    messages.add("Document academic year and semester are required for "
                            + mapping.originalPath()
                            + " (example year 2024-2025, semester 2024/1). "
                            + "Import uses the existing archive folders: Year → Semester → Student → Document type.");
                    continue;
                }
                // Match explorer tree: Year → Semester → Student → Document type → Subcategory?
                UserRole structureOwnerRole = role == UserRole.ADMIN ? UserRole.REGISTRAR : role;
                FolderEntity studentRoot = archiveTreeService.ensureOfficeStudentFolder(
                        targetFolderName,
                        context.faculty(),
                        context.department(),
                        documentAcademicYear.trim(),
                        documentSemester.trim(),
                        structureOwnerRole
                );
                folderCache.put(
                        (studentRoot.getParentId() == null ? "root" : studentRoot.getParentId())
                                + ":" + studentRoot.getName().toUpperCase(Locale.ROOT),
                        studentRoot.getId()
                );
                folderCount += 1;
                FolderEntity destination = archiveTreeService.ensureImportDocumentTypePath(
                        studentRoot,
                        primaryDocumentType,
                        registrarSubfolderName
                );
                targetFolderIds.add(destination.getId());
                String fileName = mapping.uploadFileName() != null && !mapping.uploadFileName().isBlank()
                        ? mapping.uploadFileName().trim()
                        : (mapping.originalPath().contains("/")
                        ? mapping.originalPath().substring(mapping.originalPath().lastIndexOf('/') + 1)
                        : mapping.originalPath());
                importPdf(
                        destination,
                        fileName,
                        fileBytes,
                        targetFolderName,
                        linkedImport.studentName(),
                        category,
                        mapping.subtypeId(),
                        mapping.title(),
                        uploadedBy,
                        role,
                        context.faculty(),
                        context.department(),
                        documentAcademicYear.trim(),
                        documentSemester.trim(),
                        null,
                        null,
                        primaryDocumentType,
                        registrarSubfolderName,
                        viewerDepartment
                );
                importedFiles.add(mapping.originalPath());
            } catch (IllegalArgumentException ex) {
                skippedFiles.add(mapping.originalPath());
                messages.add(ex.getMessage() + " (" + mapping.originalPath() + ")");
            }
        }

        if (importedFiles.isEmpty()) {
            throw new IllegalArgumentException(messages.isEmpty()
                    ? "No PDF files could be imported."
                    : String.join(" ", messages));
        }

        activityService.recordAction(
                "Imported " + importedFiles.size() + " file(s) into \"" + targetFolder.getName() + "\"",
                uploadedBy,
                ActivityCategory.UPLOAD,
                activityService.enrichScope(ActivityScope.builder()
                        .sourceRole(role)
                        .documentCategory(request.defaultCategory())
                        .academicDepartment(folderService.resolveAcademicDepartmentFromFolderId(targetFolder.getId()))
                        .build(), requestActor),
                requestActor
        );

        return new FolderImportResponse(
                importedFiles.size(),
                skippedFiles.size(),
                folderCount,
                importedFiles,
                skippedFiles,
                messages,
                List.copyOf(targetFolderIds)
        );
    }

    private FolderEntity findOrCreateStudentFolder(
            FolderEntity parent,
            String folderName,
            UserRole role,
            Map<String, Long> folderCache,
            String studentName
    ) {
        FolderResolution resolution = findOrCreateChildFolder(parent, folderName, role, folderCache, studentName);
        return resolution.folder();
    }

    private List<ImportCandidate> collectCandidates(
            MultipartFile archive,
            List<MultipartFile> files,
            List<String> paths
    ) throws IOException {
        Map<String, byte[]> byPath = new LinkedHashMap<>();
        if (archive != null && !archive.isEmpty()) {
            byte[] archiveBytes = archive.getBytes();
            if (!ZipBombGuard.looksLikeZip(archiveBytes, archive.getOriginalFilename(), archive.getContentType())) {
                throw new IllegalArgumentException("Only ZIP archives are supported for import.");
            }
            for (ZipBombGuard.ExtractedEntry entry : ZipBombGuard.extractSafe(archiveBytes)) {
                byPath.put(entry.relativePath(), entry.bytes());
            }
        } else if (files != null && !files.isEmpty()) {
            if (paths == null || paths.size() != files.size()) {
                throw new IllegalArgumentException("Folder import requires a path for each selected file.");
            }
            for (int index = 0; index < files.size(); index += 1) {
                MultipartFile file = files.get(index);
                if (file == null || file.isEmpty()) {
                    continue;
                }
                String relativePath = ZipBombGuard.sanitizeFolderRelativePath(ZipBombGuard.decodePath(paths.get(index)));
                if (relativePath == null) {
                    continue;
                }
                String lowerName = relativePath.toLowerCase(Locale.ROOT);
                if (lowerName.endsWith(".zip") || lowerName.endsWith(".jar") || lowerName.endsWith(".7z")) {
                    throw new IllegalArgumentException("Nested archives are not allowed in folder imports.");
                }
                byPath.put(relativePath, file.getBytes());
            }
        } else {
            throw new IllegalArgumentException("Choose a ZIP archive or a folder to import.");
        }

        if (archive != null && !archive.isEmpty()) {
            applyImportFileOverrides(byPath, files, paths);
        } else if (files != null && !files.isEmpty()) {
            applyImportFileOverrides(byPath, files, paths);
        }

        if (byPath.isEmpty()) {
            throw new IllegalArgumentException("No importable files were found.");
        }
        return byPath.entrySet().stream()
                .map(entry -> new ImportCandidate(entry.getKey(), entry.getValue()))
                .toList();
    }

    private void applyImportFileOverrides(
            Map<String, byte[]> byPath,
            List<MultipartFile> files,
            List<String> paths
    ) throws IOException {
        if (files == null || files.isEmpty()) {
            return;
        }
        if (paths == null || paths.size() != files.size()) {
            throw new IllegalArgumentException("Import file overrides require a path for each replacement file.");
        }
        for (int index = 0; index < files.size(); index += 1) {
            MultipartFile file = files.get(index);
            if (file == null || file.isEmpty()) {
                continue;
            }
            String relativePath = ZipBombGuard.sanitizeFolderRelativePath(ZipBombGuard.decodePath(paths.get(index)));
            if (relativePath == null) {
                continue;
            }
            byPath.put(relativePath, file.getBytes());
        }
    }

    public Map<String, byte[]> buildFileContentMap(
            MultipartFile archive,
            List<MultipartFile> files,
            List<String> paths
    ) throws IOException {
        Map<String, byte[]> contentMap = new HashMap<>();
        for (ImportCandidate candidate : collectCandidates(archive, files, paths)) {
            contentMap.put(candidate.relativePath(), candidate.bytes());
        }
        return contentMap;
    }

    private void importPdf(
            FolderEntity folder,
            String fileName,
            byte[] fileBytes,
            String studentNumber,
            String studentName,
            StudentDocumentCategory category,
            Long documentSubtypeId,
            String titleOverride,
            String uploadedBy,
            UserRole role,
            String faculty,
            String department,
            String placementAcademicYear,
            String placementSemester,
            String documentAcademicYear,
            String documentSemester,
            String documentTypeName,
            String viewerFaculty
    ) throws IOException {
        importPdf(
                folder,
                fileName,
                fileBytes,
                studentNumber,
                studentName,
                category,
                documentSubtypeId,
                titleOverride,
                uploadedBy,
                role,
                faculty,
                department,
                placementAcademicYear,
                placementSemester,
                documentAcademicYear,
                documentSemester,
                documentTypeName,
                documentTypeName,
                viewerFaculty
        );
    }

    private void importPdf(
            FolderEntity folder,
            String fileName,
            byte[] fileBytes,
            String studentNumber,
            String studentName,
            StudentDocumentCategory category,
            Long documentSubtypeId,
            String titleOverride,
            String uploadedBy,
            UserRole role,
            String faculty,
            String department,
            String placementAcademicYear,
            String placementSemester,
            String documentAcademicYear,
            String documentSemester,
            String primaryDocumentType,
            String documentTypeOrSubtype,
            String viewerFaculty
    ) throws IOException {
        FileSignatureValidator.requirePdf(fileBytes);
        if (fileBytes.length < MIN_FILE_BYTES) {
            throw new IllegalArgumentException("File is too small");
        }
        if (fileBytes.length > maxUploadSizeBytes) {
            throw new IllegalArgumentException("File exceeds the maximum upload size");
        }

        int pageCount;
        try (PDDocument pdfDocument = PDDocument.load(fileBytes)) {
            pageCount = pdfDocument.getNumberOfPages();
            if (pageCount < 1) {
                throw new IllegalArgumentException("PDF has no pages");
            }
        }

        StudentEntity student = null;
        if (studentNumber != null && !studentNumber.isBlank()) {
            String resolvedName = studentName == null || studentName.isBlank() ? studentNumber : studentName.trim();
            student = resolveStudentForImport(studentNumber, resolvedName, faculty, department, role, viewerFaculty);
        }

        Path importRoot = student == null
                ? storageRoot.resolve("folder-import").resolve(String.valueOf(folder.getId()))
                : archiveTreeService.resolveImportStoragePath(
                        storageRoot,
                        student,
                        faculty,
                        department,
                        placementAcademicYear,
                        placementSemester,
                        documentAcademicYear,
                        documentSemester,
                        primaryDocumentType,
                        documentTypeOrSubtype
                );
        Files.createDirectories(importRoot);

        String safeOriginalName = sanitizeFileName(fileName);
        String storedName = UUID.randomUUID() + "_" + safeOriginalName;
        Path target = importRoot.resolve(storedName).toAbsolutePath().normalize();
        FileEncryptionService.EncryptedPayload encrypted = fileEncryptionService.encrypt(fileBytes);
        Files.write(target, encrypted.bytes(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        DocumentEntity entity = new DocumentEntity();
        entity.setTitle(titleOverride == null || titleOverride.isBlank()
                ? stripExtension(safeOriginalName)
                : titleOverride.trim());
        entity.setFileName(safeOriginalName);
        entity.setDocumentCode("IMP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT));
        entity.setOwnerName(student == null ? uploadedBy : student.getFullName());
        entity.setStudentNumber(student == null ? null : student.getStudentNumber());
        entity.setDepartment(student == null ? null : student.getDepartment());
        entity.setUploadedBy(uploadedBy);
        entity.setUploadedByRole(role);
        entity.setDescription("Imported from external archive");
        entity.setFilePath(archiveStoragePaths.toStoredPath(target));
        entity.setEncrypted(fileEncryptionService.isEnabled());
        entity.setEncryptionIv(encrypted.ivBase64());
        entity.setMimeType("application/pdf");
        entity.setFolderId(folder.getId());
        entity.setSizeBytes((long) fileBytes.length);
        entity.setPageCount(pageCount);
        entity.setIssueDate(LocalDate.now());
        entity.setStarred(Boolean.FALSE);
        entity.setStatus(DocumentStatus.APPROVED);
        entity.setType(DocumentType.PDF);
        entity.setCategory(category);
        entity.setDocumentSubtypeId(documentSubtypeId);
        String storedAcademicYear = documentAcademicYear != null && !documentAcademicYear.isBlank()
                ? academicTermService.normalizeAcademicYear(documentAcademicYear)
                : academicTermService.normalizeAcademicYear(placementAcademicYear);
        entity.setAcademicYear(storedAcademicYear);
        entity.setSemester(documentSemester != null && !documentSemester.isBlank()
                ? documentSemester.trim()
                : placementSemester);
        entity.setContentChecksumSha256(checksumService.sha256Hex(fileBytes));
        entity.setChecksumAlgorithm("SHA-256");
        entity.setCompressed(Boolean.FALSE);
        entity.setOriginalSizeBytes((long) fileBytes.length);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setModifiedAt(LocalDateTime.now());
        DocumentEntity saved = documentRepository.save(entity);
        pdfOptimizationService.optimizeDocumentAsync(saved.getId());
    }

    private ResolvedTarget resolveTargetFolder(
            FolderEntity targetFolder,
            String relativePath,
            UserRole role,
            Map<String, Long> folderCache
    ) {
        String normalized = relativePath.replace('\\', '/');
        int slashIndex = normalized.lastIndexOf('/');
        String directoryPath = slashIndex >= 0 ? normalized.substring(0, slashIndex) : "";
        String fileName = slashIndex >= 0 ? normalized.substring(slashIndex + 1) : normalized;

        FolderEntity currentFolder = targetFolder;
        String resolvedStudentNumber = null;
        int createdFolders = 0;

        if (!directoryPath.isBlank()) {
            for (String segment : directoryPath.split("/")) {
                if (segment == null || segment.isBlank()) {
                    continue;
                }
                String trimmedSegment = segment.trim();
                if (studentIdFormatService.isRecognizedFormat(trimmedSegment)) {
                    resolvedStudentNumber = trimmedSegment.toUpperCase(Locale.ROOT);
                }
                FolderResolution resolution = findOrCreateChildFolder(currentFolder, trimmedSegment, role, folderCache);
                currentFolder = resolution.folder();
                if (resolution.created()) {
                    createdFolders += 1;
                }
            }
        }

        return new ResolvedTarget(currentFolder, fileName, resolvedStudentNumber, createdFolders);
    }

    private FolderResolution findOrCreateChildFolder(
            FolderEntity parent,
            String segment,
            UserRole role,
            Map<String, Long> folderCache,
            String studentName
    ) {
        String cacheKey = parent.getId() + ":" + segment.toUpperCase(Locale.ROOT);
        if (folderCache.containsKey(cacheKey)) {
            return new FolderResolution(folderService.getFolderOrThrow(folderCache.get(cacheKey)), false);
        }

        Optional<FolderEntity> existing = folderRepository.findAll().stream()
                .filter(folder -> Objects.equals(folder.getParentId(), parent.getId()))
                .filter(folder -> segment.equalsIgnoreCase(folder.getName()))
                .findFirst();
        if (existing.isPresent()) {
            folderCache.put(cacheKey, existing.get().getId());
            return new FolderResolution(existing.get(), false);
        }

        if (!studentIdFormatService.isRecognizedFormat(segment)) {
            throw new IllegalArgumentException("Only student-ID folder names can be created during import");
        }

        FolderNodeResponse created = folderService.createSubfolder(
                parent.getId(),
                segment.toUpperCase(Locale.ROOT),
                studentName,
                role.name(),
                null
        );
        folderCache.put(cacheKey, created.id());
        return new FolderResolution(folderService.getFolderOrThrow(created.id()), true);
    }

    private ImportPreviewItemResponse markNonImportablePreviewItem(ImportPreviewItemResponse item, byte[] bytes) {
        boolean image = FileSignatureValidator.isImage(bytes);
        String fileKind = image ? "IMAGE" : "OTHER";
        String skipReason = image
                ? "Not a PDF — images cannot be imported into the archive"
                : "Not a PDF — only PDF files can be imported into the archive";
        return copyPreviewItem(
                item,
                item.suggestedFolderName(),
                item.suggestedStudentNumber(),
                item.suggestedStudentName(),
                item.resolutionSource(),
                item.validationSimilarityScore(),
                item.validationVerified(),
                item.scanSummary(),
                item.scanSignals(),
                item.scanPreview(),
                false,
                fileKind,
                skipReason
        );
    }

    private ImportPreviewItemResponse applyLinkedStudentPreview(ImportPreviewItemResponse item, String linkedStudentNumber) {
        return copyPreviewItem(
                item,
                linkedStudentNumber,
                linkedStudentNumber,
                item.suggestedStudentName(),
                "importContext",
                item.validationSimilarityScore(),
                item.validationVerified(),
                item.scanSummary(),
                item.scanSignals(),
                item.scanPreview(),
                item.importable(),
                item.fileKind(),
                item.skipReason()
        );
    }

    private ImportPreviewItemResponse enrichItemWithDocumentScan(
            ImportPreviewItemResponse item,
            byte[] pdfBytes,
            StudentDocumentCategory category,
            ImportPathResolutionService.ArchiveFolderContext context,
            UserRole role,
            String linkedStudentName
    ) throws IOException {
        if (pdfBytes == null || pdfBytes.length == 0) {
            return item;
        }
        String studentNumber = item.suggestedFolderName();
        String studentName = item.suggestedStudentName();
        if ((studentName == null || studentName.isBlank()) && linkedStudentName != null && !linkedStudentName.isBlank()) {
            studentName = linkedStudentName;
        }
        DocumentScanContext scanContext = new DocumentScanContext(
                studentNumber,
                studentName,
                category == null ? null : category.name(),
                null,
                context.faculty(),
                context.department(),
                item.originalPath(),
                null,
                role.getDepartment()
        );
        DocumentScanResponse scan = documentScanService.scanPdf(pdfBytes, scanContext);
        return copyPreviewItem(
                item,
                item.suggestedFolderName(),
                item.suggestedStudentNumber(),
                item.suggestedStudentName(),
                item.resolutionSource(),
                scan.similarityScore(),
                scan.verified(),
                scan.summary(),
                scan.matchedSignals() == null ? List.of() : scan.matchedSignals(),
                scan.preview(),
                item.importable(),
                item.fileKind(),
                item.skipReason()
        );
    }

    private ImportPreviewItemResponse copyPreviewItem(
            ImportPreviewItemResponse item,
            String suggestedFolderName,
            String suggestedStudentNumber,
            String suggestedStudentName,
            String resolutionSource,
            Integer validationSimilarityScore,
            Boolean validationVerified,
            String scanSummary,
            List<String> scanSignals,
            String scanPreview,
            boolean importable,
            String fileKind,
            String skipReason
    ) {
        return new ImportPreviewItemResponse(
                item.originalPath(),
                suggestedFolderName,
                suggestedStudentNumber,
                suggestedStudentName,
                resolutionSource,
                item.proposedTitle(),
                item.warnings(),
                item.conflicts(),
                validationSimilarityScore,
                validationVerified,
                scanSummary,
                scanSignals,
                scanPreview,
                item.studentExists(),
                item.existingStudentName(),
                item.existingFolderId(),
                item.folderExistsHere(),
                importable,
                fileKind,
                skipReason
        );
    }

    private void requireImportDocumentVerified(
            byte[] fileBytes,
            String studentNumber,
            String studentName,
            StudentDocumentCategory category,
            String faculty,
            String department,
            String originalPath,
            UserRole role,
            boolean insideStudentTree
    ) throws IOException {
        DocumentScanContext scanContext = new DocumentScanContext(
                studentNumber,
                studentName,
                category == null ? null : category.name(),
                null,
                faculty,
                department,
                originalPath,
                null,
                role.getDepartment()
        );
        DocumentScanResponse scan = documentScanService.scanPdf(fileBytes, scanContext);
        if (scan.verified()) {
            return;
        }
        boolean allowOverride = insideStudentTree
                && (role == UserRole.REGISTRAR
                || role == UserRole.FINANCE
                || role == UserRole.DEAN_OF_FACULTY
                || role == UserRole.ADMIN);
        if (allowOverride) {
            return;
        }
        throw new IllegalArgumentException(scan.summary());
    }

    private LinkedImportContext resolveLinkedImportContext(
            FolderEntity targetFolder,
            ImportCommitRequest request,
            ImportPathResolutionService.ArchiveFolderContext context,
            UserRole role,
            String viewerFaculty
    ) {
        boolean insideStudentTree = folderService.isWithinSemesterStudentTree(targetFolder);
        if (insideStudentTree) {
            String studentNumber = folderService.resolveSemesterStudentNumber(targetFolder)
                    .orElseThrow(() -> new IllegalArgumentException("Could not resolve the student ID from this folder."));
            if (request.linkedStudentNumber() != null
                    && !request.linkedStudentNumber().isBlank()
                    && !studentNumber.equalsIgnoreCase(request.linkedStudentNumber().trim())) {
                throw new IllegalArgumentException("This import must stay linked to student " + studentNumber + ".");
            }
            String studentName = resolveImportStudentName(studentNumber, request.linkedStudentName(), false);
            FolderEntity semesterFolder = resolveSemesterFolderEntity(targetFolder);
            return new LinkedImportContext(studentNumber, studentName, true, semesterFolder);
        }

        String studentNumber = request.linkedStudentNumber();
        if (studentNumber == null || studentNumber.isBlank()) {
            throw new IllegalArgumentException("Student ID is required before import.");
        }
        String normalized = studentNumber.trim().toUpperCase(Locale.ROOT);
        if (request.linkLegacy() && studentIdFormatService.isLegacyFormat(normalized)) {
            studentService.findByStudentNumber(normalized)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Legacy student folder \"" + normalized + "\" does not match an existing student record."
                    ));
        } else {
            studentIdFormatService.requireStaffFolderName(normalized);
        }
        String studentName = resolveImportStudentName(normalized, request.linkedStudentName(), false);
        List<String> conflicts = studentService.detectConflicts(
                normalized,
                studentName,
                context.faculty(),
                context.department(),
                true
        );
        if (!conflicts.isEmpty()) {
            throw new IllegalArgumentException(String.join(" ", conflicts));
        }
        resolveStudentForImport(normalized, studentName, context.faculty(), context.department(), role, viewerFaculty);
        FolderEntity semesterFolder = resolveSemesterFolderEntity(targetFolder);
        if (semesterFolder == null) {
            throw new IllegalArgumentException("Open a semester folder before importing for a student.");
        }
        return new LinkedImportContext(normalized, studentName, false, semesterFolder);
    }

    private String resolveImportStudentName(String studentNumber, String requestedName, boolean allowMissing) {
        if (studentNumber == null || studentNumber.isBlank()) {
            return allowMissing ? null : "";
        }
        Optional<StudentEntity> existing = studentService.findByStudentNumber(studentNumber.trim());
        if (existing.isPresent()) {
            String fullName = existing.get().getFullName();
            return fullName == null || fullName.isBlank() ? studentNumber.trim() : fullName.trim();
        }
        if (requestedName == null || requestedName.isBlank()) {
            if (allowMissing) {
                return null;
            }
            throw new IllegalArgumentException("Student name is required to link new student ID " + studentNumber.trim());
        }
        return requestedName.trim();
    }

    private FolderEntity resolveSemesterFolderEntity(FolderEntity folder) {
        FolderEntity current = folder;
        Map<Long, FolderEntity> visited = new java.util.LinkedHashMap<>();
        while (current != null && !visited.containsKey(current.getId())) {
            visited.put(current.getId(), current);
            String code = current.getCode() == null ? "" : current.getCode().toUpperCase(Locale.ROOT);
            String name = current.getName() == null ? "" : current.getName().trim();
            if ((code.contains("-SEM-") && !code.contains("-STU-")) || name.matches("^\\d{4}/\\d$")) {
                return current;
            }
            if (current.getParentId() == null) {
                break;
            }
            current = folderRepository.findById(current.getParentId()).orElse(null);
        }
        return null;
    }

    private record LinkedImportContext(
            String studentNumber,
            String studentName,
            boolean insideStudentTree,
            FolderEntity semesterFolder
    ) {
    }

    private FolderResolution findOrCreateChildFolder(
            FolderEntity parent,
            String segment,
            UserRole role,
            Map<String, Long> folderCache
    ) {
        return findOrCreateChildFolder(parent, segment, role, folderCache, null);
    }

    private StudentDocumentCategory defaultCategoryForRole(UserRole role) {
        return switch (role) {
            case EXAMINATION_OFFICER -> StudentDocumentCategory.EXAMINATION_DOCUMENTS;
            case HOD -> StudentDocumentCategory.APPLICATION_DOCUMENTS;
            default -> StudentDocumentCategory.APPLICATION_DOCUMENTS;
        };
    }

    private void requireImportRole(UserRole role) {
        if (role == null || !role.canImportIntoArchive()) {
            throw new IllegalArgumentException("You are not allowed to import files into the archive.");
        }
    }

    private boolean isSemesterOrDeeperFolder(FolderEntity folder) {
        if (folder == null || folder.getCode() == null) {
            return false;
        }
        return folder.getCode().toUpperCase(Locale.ROOT).contains("-SEM-");
    }

    private String sanitizeFileName(String fileName) {
        return fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String stripExtension(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex <= 0) {
            return fileName;
        }
        return fileName.substring(0, dotIndex);
    }

    private record ImportCandidate(String relativePath, byte[] bytes) {
        String fileName() {
            int slashIndex = relativePath.lastIndexOf('/');
            return slashIndex >= 0 ? relativePath.substring(slashIndex + 1) : relativePath;
        }
    }

    private record ResolvedTarget(
            FolderEntity folder,
            String fileName,
            String studentNumber,
            int createdFolders
    ) {
    }

    private record FolderResolution(FolderEntity folder, boolean created) {
    }

    private StudentEntity resolveStudentForImport(
            String studentNumber,
            String studentName,
            String faculty,
            String department,
            UserRole role,
            String viewerFaculty
    ) {
        if (role == UserRole.REGISTRAR || role == UserRole.ADMIN) {
            UserRole creatorRole = role == UserRole.ADMIN ? UserRole.REGISTRAR : role;
            return studentService.resolveOrCreate(
                    studentNumber,
                    studentName,
                    faculty,
                    department,
                    true,
                    creatorRole
            );
        }
        studentEnrollmentService.requireEnrollmentForRole(studentNumber, role, viewerFaculty);
        return studentService.requireExistingStudent(studentNumber);
    }
}
