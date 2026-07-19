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
    private final StudentIdFormatService studentIdFormatService;
    private final FileEncryptionService fileEncryptionService;
    private final ActivityService activityService;
    private final ImportPathResolutionService importPathResolutionService;
    private final DocumentTemplateValidationService templateValidationService;
    private final ArchiveTreeService archiveTreeService;
    private final DocumentChecksumService checksumService;
    private final PdfOptimizationService pdfOptimizationService;
    private final Path storageRoot;
    private final long maxUploadSizeBytes;

    public FolderImportService(
            FolderService folderService,
            FolderRepository folderRepository,
            DocumentRepository documentRepository,
            ArchiveAccessService accessService,
            StudentService studentService,
            StudentIdFormatService studentIdFormatService,
            FileEncryptionService fileEncryptionService,
            ActivityService activityService,
            ImportPathResolutionService importPathResolutionService,
            DocumentTemplateValidationService templateValidationService,
            ArchiveTreeService archiveTreeService,
            DocumentChecksumService checksumService,
            PdfOptimizationService pdfOptimizationService,
            @Value("${archive.storage-root:storage}") String storageRoot,
            @Value("${archive.max-upload-size-bytes:10485760}") long maxUploadSizeBytes
    ) {
        this.folderService = folderService;
        this.folderRepository = folderRepository;
        this.documentRepository = documentRepository;
        this.accessService = accessService;
        this.studentService = studentService;
        this.studentIdFormatService = studentIdFormatService;
        this.fileEncryptionService = fileEncryptionService;
        this.activityService = activityService;
        this.importPathResolutionService = importPathResolutionService;
        this.templateValidationService = templateValidationService;
        this.archiveTreeService = archiveTreeService;
        this.checksumService = checksumService;
        this.pdfOptimizationService = pdfOptimizationService;
        this.storageRoot = Path.of(storageRoot);
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
        UserRole role = accessService.resolveRole(rawRole);
        requireImportRole(role);

        FolderEntity targetFolder = folderService.getFolderOrThrow(folderId);
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
                importPdf(
                        resolvedTarget.folder(),
                        candidate.fileName(),
                        candidate.bytes(),
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
                        category.getDisplayName()
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
                messages
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
        UserRole role = accessService.resolveRole(rawRole);
        requireImportRole(role);
        FolderEntity targetFolder = folderService.getFolderOrThrow(folderId);
        if (!isSemesterOrDeeperFolder(targetFolder)) {
            throw new IllegalArgumentException("Open a semester folder or deeper before importing files.");
        }

        List<ImportCandidate> candidates = collectCandidates(archive, files, paths);
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
            if (!FileSignatureValidator.isPdf(candidate.bytes())) {
                skippedCount += 1;
                messages.add("Skipped non-PDF file: " + candidate.relativePath());
                continue;
            }
            ImportPreviewItemResponse item = importPathResolutionService.resolveItem(
                    candidate.relativePath(),
                    candidate.fileName(),
                    targetFolder,
                    context.faculty(),
                    context.department(),
                    context.academicYear(),
                    context.semester(),
                    candidate.bytes()
            );
            items.add(item);
        }

        return new ImportPreviewResponse(
                candidates.size(),
                items.size(),
                skippedCount,
                category,
                defaultSubtypeId,
                items,
                messages,
                zipAudit
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
        UserRole role = accessService.resolveRole(rawRole);
        requireImportRole(role);
        FolderEntity targetFolder = folderService.getFolderOrThrow(folderId);
        folderService.requireShareAtLeast(targetFolder, role, null, SharePermission.WRITE);
        if (!isSemesterOrDeeperFolder(targetFolder)) {
            throw new IllegalArgumentException("Open a semester folder or deeper before importing files.");
        }

        String uploadedBy = rawUserName == null || rawUserName.isBlank() ? role.name() : rawUserName.trim();
        ImportPathResolutionService.ArchiveFolderContext context = importPathResolutionService.resolveFolderContext(targetFolder);
        Map<String, Long> folderCache = new HashMap<>();
        List<String> importedFiles = new ArrayList<>();
        List<String> skippedFiles = new ArrayList<>();
        List<String> messages = new ArrayList<>();
        int folderCount = 0;

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

            String targetFolderName = mapping.targetFolderName().trim().toUpperCase(Locale.ROOT);
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
                    null,
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
            if (request.validateTemplates() && validationCategory != null) {
                try {
                    var scan = templateValidationService.validatePdf(
                            fileBytes,
                            new com.auca.archive.dto.DocumentScanContext(
                                    targetFolderName,
                                    null,
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
                FolderEntity studentRoot = findOrCreateStudentFolder(
                        targetFolder,
                        targetFolderName,
                        role,
                        folderCache
                );
                folderCount += 1;
                String fileName = mapping.originalPath().contains("/")
                        ? mapping.originalPath().substring(mapping.originalPath().lastIndexOf('/') + 1)
                        : mapping.originalPath();
                StudentDocumentCategory category = mapping.category() == null
                        ? (request.defaultCategory() == null ? defaultCategoryForRole(role) : request.defaultCategory())
                        : mapping.category();
                String documentTypeName = category.getDisplayName();
                FolderEntity documentFolder = archiveTreeService.ensureStudentDocumentPath(
                        studentRoot,
                        context.academicYear(),
                        context.semester(),
                        documentTypeName
                );
                importPdf(
                        documentFolder,
                        fileName,
                        fileBytes,
                        targetFolderName,
                        category,
                        mapping.subtypeId(),
                        mapping.title(),
                        uploadedBy,
                        role,
                        context.faculty(),
                        context.department(),
                        context.academicYear(),
                        context.semester(),
                        documentTypeName
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
                messages
        );
    }

    private FolderEntity findOrCreateStudentFolder(
            FolderEntity parent,
            String folderName,
            UserRole role,
            Map<String, Long> folderCache
    ) {
        FolderResolution resolution = findOrCreateChildFolder(parent, folderName, role, folderCache);
        return resolution.folder();
    }

    private List<ImportCandidate> collectCandidates(
            MultipartFile archive,
            List<MultipartFile> files,
            List<String> paths
    ) throws IOException {
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
        return candidates;
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
            StudentDocumentCategory category,
            Long documentSubtypeId,
            String titleOverride,
            String uploadedBy,
            UserRole role,
            String faculty,
            String department,
            String academicYear,
            String semester,
            String documentTypeName
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
            student = studentService.resolveOrCreate(studentNumber, studentNumber, faculty, department, true);
        }

        Path importRoot = student == null
                ? storageRoot.resolve("folder-import").resolve(String.valueOf(folder.getId()))
                : archiveTreeService.resolveImportStoragePath(
                        storageRoot,
                        student,
                        faculty,
                        department,
                        academicYear,
                        semester,
                        documentTypeName
                );
        Files.createDirectories(importRoot);

        String safeOriginalName = sanitizeFileName(fileName);
        String storedName = UUID.randomUUID() + "_" + safeOriginalName;
        Path target = importRoot.resolve(storedName);
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
        entity.setFilePath(target.toString());
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
        entity.setAcademicYear(academicYear);
        entity.setSemester(semester);
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
            Map<String, Long> folderCache
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
                role.name(),
                null,
                true
        );
        folderCache.put(cacheKey, created.id());
        return new FolderResolution(folderService.getFolderOrThrow(created.id()), true);
    }

    private StudentDocumentCategory defaultCategoryForRole(UserRole role) {
        return switch (role) {
            case EXAMINATION_OFFICER -> StudentDocumentCategory.EXAMINATION_DOCUMENTS;
            case HOD -> StudentDocumentCategory.APPLICATION_DOCUMENTS;
            default -> StudentDocumentCategory.APPLICATION_DOCUMENTS;
        };
    }

    private void requireImportRole(UserRole role) {
        if (role != UserRole.REGISTRAR
                && role != UserRole.EXAMINATION_OFFICER
                && role != UserRole.HOD
                && role != UserRole.ADMIN) {
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
}
