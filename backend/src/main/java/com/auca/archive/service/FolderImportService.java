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
import com.auca.archive.dto.FolderImportResponse;
import com.auca.archive.dto.FolderNodeResponse;
import com.auca.archive.model.DocumentEntity;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.model.StudentEntity;
import com.auca.archive.repository.DocumentRepository;
import com.auca.archive.repository.FolderRepository;
import jakarta.transaction.Transactional;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
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
    private static final float PAGE_SIZE_TOLERANCE = 12f;
    private static final float A4_WIDTH = 595f;
    private static final float A4_HEIGHT = 842f;
    private static final float LETTER_WIDTH = 612f;
    private static final float LETTER_HEIGHT = 792f;
    private static final long MIN_FILE_BYTES = 1024L;

    private final FolderService folderService;
    private final FolderRepository folderRepository;
    private final DocumentRepository documentRepository;
    private final ArchiveAccessService accessService;
    private final StudentService studentService;
    private final StudentIdFormatService studentIdFormatService;
    private final FileEncryptionService fileEncryptionService;
    private final ActivityService activityService;
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
                        uploadedBy,
                        role
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

    private void importPdf(
            FolderEntity folder,
            String fileName,
            byte[] fileBytes,
            String studentNumber,
            StudentDocumentCategory category,
            String uploadedBy,
            UserRole role
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
            int pageNumber = 1;
            for (PDPage page : pdfDocument.getPages()) {
                if (!isNormalPageSize(page.getMediaBox())) {
                    throw new IllegalArgumentException("Only A4 or Letter page sizes are allowed on page " + pageNumber);
                }
                pageNumber += 1;
            }
        }

        StudentEntity student = null;
        if (studentNumber != null && !studentNumber.isBlank()) {
            student = studentService.resolveOrCreate(studentNumber, studentNumber, null, null);
        }

        Path importRoot = storageRoot
                .resolve("folder-import")
                .resolve(String.valueOf(folder.getId()));
        Files.createDirectories(importRoot);

        String safeOriginalName = sanitizeFileName(fileName);
        String storedName = UUID.randomUUID() + "_" + safeOriginalName;
        Path target = importRoot.resolve(storedName);
        FileEncryptionService.EncryptedPayload encrypted = fileEncryptionService.encrypt(fileBytes);
        Files.write(target, encrypted.bytes(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        DocumentEntity entity = new DocumentEntity();
        entity.setTitle(stripExtension(safeOriginalName));
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
        entity.setCreatedAt(LocalDateTime.now());
        entity.setModifiedAt(LocalDateTime.now());
        documentRepository.save(entity);
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
                null
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

    private boolean isNormalPageSize(PDRectangle mediaBox) {
        if (mediaBox == null) {
            return false;
        }
        float width = mediaBox.getWidth();
        float height = mediaBox.getHeight();
        return matchesPageSize(width, height, A4_WIDTH, A4_HEIGHT)
                || matchesPageSize(width, height, LETTER_WIDTH, LETTER_HEIGHT);
    }

    private boolean matchesPageSize(float width, float height, float expectedWidth, float expectedHeight) {
        return Math.abs(width - expectedWidth) <= PAGE_SIZE_TOLERANCE
                && Math.abs(height - expectedHeight) <= PAGE_SIZE_TOLERANCE;
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
