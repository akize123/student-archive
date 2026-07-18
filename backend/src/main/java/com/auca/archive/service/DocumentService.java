package com.auca.archive.service;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.ApprovalStatus;
import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.domain.DocumentType;
import com.auca.archive.domain.ExamPaperType;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.ActivityScope;
import com.auca.archive.dto.DocumentDetailResponse;
import com.auca.archive.dto.DocumentListItemResponse;
import com.auca.archive.dto.DocumentShareAccessContext;
import com.auca.archive.dto.RequestActor;
import com.auca.archive.dto.UploadDocumentRequest;
import com.auca.archive.util.FileSignatureValidator;
import com.auca.archive.model.ApprovalTaskEntity;
import com.auca.archive.model.DocumentEntity;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.model.StudentEntity;
import com.auca.archive.repository.ApprovalTaskRepository;
import com.auca.archive.repository.DocumentRepository;
import jakarta.transaction.Transactional;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class DocumentService {
    private static final long FYP_ZIP_MAX_BYTES = 1024L * 1024L;

    private final DocumentRepository documentRepository;
    private final FolderService folderService;
    private final StudentService studentService;
    private final ArchiveAccessService accessService;
    private final DocumentScanService documentScanService;
    private final MalwareScanService malwareScanService;
    private final ArchiveTreeService archiveTreeService;
    private final FileEncryptionService fileEncryptionService;
    private final ActivityService activityService;
    private final ApprovalTaskRepository approvalTaskRepository;
    private final ProjectLinkValidator projectLinkValidator;
    private final DocumentElasticsearchService documentElasticsearchService;
    private final StudentStorageService studentStorageService;
    private final ReservationService reservationService;
    private final Path storageRoot;
    private final long minUploadSizeBytes;
    private final long maxUploadSizeBytes;
    private final long studentMaxUploadSizeBytes;

    public DocumentService(
            DocumentRepository documentRepository,
            FolderService folderService,
            StudentService studentService,
            ArchiveAccessService accessService,
            DocumentScanService documentScanService,
            MalwareScanService malwareScanService,
            ArchiveTreeService archiveTreeService,
            FileEncryptionService fileEncryptionService,
            ActivityService activityService,
            ApprovalTaskRepository approvalTaskRepository,
            ProjectLinkValidator projectLinkValidator,
            @org.springframework.beans.factory.annotation.Autowired(required = false)
            DocumentElasticsearchService documentElasticsearchService,
            StudentStorageService studentStorageService,
            ReservationService reservationService,
            @Value("${archive.min-upload-size-bytes:1024}") long minUploadSizeBytes,
            @Value("${archive.max-upload-size-bytes:10485760}") long maxUploadSizeBytes,
            @Value("${archive.student.max-upload-size-bytes:5242880}") long studentMaxUploadSizeBytes,
            @Value("${archive.storage-root:storage}") String storageRoot
    ) {
        this.documentRepository = documentRepository;
        this.folderService = folderService;
        this.studentService = studentService;
        this.accessService = accessService;
        this.documentScanService = documentScanService;
        this.malwareScanService = malwareScanService;
        this.archiveTreeService = archiveTreeService;
        this.fileEncryptionService = fileEncryptionService;
        this.activityService = activityService;
        this.approvalTaskRepository = approvalTaskRepository;
        this.projectLinkValidator = projectLinkValidator;
        this.documentElasticsearchService = documentElasticsearchService;
        this.studentStorageService = studentStorageService;
        this.reservationService = reservationService;
        this.storageRoot = Path.of(storageRoot).toAbsolutePath().normalize();
        this.minUploadSizeBytes = minUploadSizeBytes;
        this.maxUploadSizeBytes = maxUploadSizeBytes;
        this.studentMaxUploadSizeBytes = studentMaxUploadSizeBytes;
    }

    public List<DocumentListItemResponse> search(String query) {
        return search(query, null, null);
    }

    public List<DocumentListItemResponse> search(String query, StudentDocumentCategory category) {
        return search(query, category, null);
    }

    public List<DocumentListItemResponse> search(String query, StudentDocumentCategory category, String rawRole) {
        return search(query, category, rawRole, null);
    }

    public List<DocumentListItemResponse> search(
            String query,
            StudentDocumentCategory category,
            String rawRole,
            String rawStudentNumber
    ) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        boolean hasQuery = query != null && !query.isBlank();
        List<DocumentEntity> documents;

        if (!hasQuery && role == UserRole.STUDENT && studentNumber != null) {
            documents = documentRepository.findByStudentNumberIgnoreCaseOrderByIssueDateDesc(studentNumber);
        } else if (!hasQuery) {
            documents = documentRepository.findAll().stream()
                    .sorted((left, right) -> {
                        LocalDateTime leftTime = left.getModifiedAt();
                        LocalDateTime rightTime = right.getModifiedAt();
                        if (leftTime == null && rightTime == null) return 0;
                        if (leftTime == null) return 1;
                        if (rightTime == null) return -1;
                        return rightTime.compareTo(leftTime);
                    })
                    .toList();
        } else {
            String trimmed = query.trim();
            documents = searchDocumentsFromStore(trimmed, category);
        }

        if (category != null) {
            documents = documents.stream()
                    .filter(document -> category.equals(document.getCategory()))
                    .toList();
        }

        return documents.stream()
                .filter(document -> !document.isArchivedForRemoval())
                .filter(document -> folderService.isDocumentAccessible(document, role, studentNumber))
                .map(this::toListItem)
                .toList();
    }

    public List<DocumentListItemResponse> listArchived(String rawRole) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        List<DocumentEntity> documents = role == UserRole.ADMIN
                ? documentRepository.findByArchivedAtIsNotNullOrderByArchivedAtDesc()
                : documentRepository.findByArchivedAtIsNotNullAndArchivedByOrderByArchivedAtDesc(role.name());
        return documents.stream()
                .filter(document -> folderService.isDocumentAccessible(document, role, null))
                .map(this::toListItem)
                .toList();
    }

    public DocumentDetailResponse getDocument(Long id) {
        return getDocument(id, null);
    }

    public DocumentDetailResponse getDocument(Long id, String rawRole) {
        return getDocument(id, rawRole, null);
    }

    public DocumentDetailResponse getDocument(Long id, String rawRole, String rawStudentNumber) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        DocumentEntity document = documentRepository.findById(id)
                .filter(entity -> !entity.isArchivedForRemoval())
                .filter(entity -> folderService.isDocumentAccessible(entity, role, studentNumber))
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));
        return toDetail(document, role, studentNumber);
    }

    public Resource preview(Long id, String rawRole, String rawStudentNumber) throws IOException {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        DocumentEntity document = documentRepository.findById(id)
                .filter(entity -> !entity.isArchivedForRemoval())
                .filter(entity -> folderService.isDocumentAccessible(entity, role, studentNumber))
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));
        requireReservationForPeerDownload(document, role, studentNumber);
        return loadDocumentResource(document);
    }

    private Resource loadDocumentResource(DocumentEntity document) throws IOException {
        if (document.getFilePath() == null || document.getFilePath().isBlank()) {
            throw new IllegalArgumentException("Document has no stored file");
        }
        Path path = Path.of(document.getFilePath());
        if (!Files.exists(path)) {
            throw new IllegalArgumentException("Stored file is unavailable");
        }
        byte[] storedBytes = Files.readAllBytes(path);
        byte[] plainBytes = fileEncryptionService.decrypt(storedBytes, document.getEncryptionIv());
        String filename = document.getFileName() == null || document.getFileName().isBlank()
                ? "document.pdf"
                : document.getFileName();
        return new ByteArrayResource(plainBytes) {
            @Override
            public String getFilename() {
                return filename;
            }
        };
    }

    public Resource download(Long id) throws IOException {
        return download(id, null);
    }

    public Resource download(Long id, String rawRole) throws IOException {
        return download(id, rawRole, null);
    }

    public Resource download(Long id, String rawRole, String rawStudentNumber) throws IOException {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        DocumentEntity document = documentRepository.findById(id)
                .filter(entity -> !entity.isArchivedForRemoval())
                .filter(entity -> folderService.isDocumentAccessible(entity, role, studentNumber))
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));
        folderService.requireDocumentDownloadAllowed(document, role, studentNumber);
        requireReservationForPeerDownload(document, role, studentNumber);
        return loadDocumentResource(document);
    }

    public Resource downloadCover(Long id) throws IOException {
        return downloadCover(id, null, null);
    }

    public Resource downloadCover(Long id, String rawRole, String rawStudentNumber) throws IOException {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        DocumentEntity document = documentRepository.findById(id)
                .filter(entity -> !entity.isArchivedForRemoval())
                .filter(entity -> folderService.isDocumentAccessible(entity, role, studentNumber))
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));
        requireReservationForPeerDownload(document, role, studentNumber);
        if (document.getCoverPhotoPath() == null || document.getCoverPhotoPath().isBlank()) {
            throw new IllegalArgumentException("Document has no cover photo");
        }
        Path path = Path.of(document.getCoverPhotoPath());
        if (!Files.exists(path)) {
            throw new IllegalArgumentException("Cover photo is unavailable");
        }
        byte[] bytes = Files.readAllBytes(path);
        String filename = path.getFileName() == null ? "cover.jpg" : path.getFileName().toString();
        return new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return filename;
            }
        };
    }

    public String resolveCoverContentType(String filename) {
        String lower = filename == null ? "" : filename.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) {
            return MediaType.IMAGE_PNG_VALUE;
        }
        if (lower.endsWith(".webp")) {
            return "image/webp";
        }
        return MediaType.IMAGE_JPEG_VALUE;
    }

    @Transactional
    public DocumentDetailResponse upload(UploadDocumentRequest request, MultipartFile file) throws IOException {
        return upload(request, file, null);
    }

    @Transactional
    public DocumentDetailResponse upload(UploadDocumentRequest request, MultipartFile file, String rawRole) throws IOException {
        return upload(request, file, rawRole, null);
    }

    @Transactional
    public DocumentDetailResponse upload(
            UploadDocumentRequest request,
            MultipartFile file,
            String rawRole,
            String rawStudentNumber
    ) throws IOException {
        return upload(request, file, null, rawRole, rawStudentNumber);
    }

    @Transactional
    public DocumentDetailResponse upload(
            UploadDocumentRequest request,
            MultipartFile file,
            MultipartFile coverPhoto,
            String rawRole,
            String rawStudentNumber
    ) throws IOException {
        return upload(request, file, coverPhoto, rawRole, rawStudentNumber, RequestActor.empty());
    }

    @Transactional
    public DocumentDetailResponse upload(
            UploadDocumentRequest request,
            MultipartFile file,
            MultipartFile coverPhoto,
            String rawRole,
            String rawStudentNumber,
            RequestActor requestActor
    ) throws IOException {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String sessionStudentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, sessionStudentNumber);
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Document file is required");
        }
        byte[] fileBytes = file.getBytes();
        validateUpload(request, file, fileBytes, role);
        if (request.category() == null) {
            if (!allowsNullUploadCategory(role)) {
                throw new IllegalArgumentException("Document category is required");
            }
        } else if (!accessService.canUploadCategory(role, request.category())) {
            throw new IllegalArgumentException("You are not allowed to upload this document category");
        }
        if (role == UserRole.STUDENT) {
            accessService.requireOwnStudentNumber(role, sessionStudentNumber, request.studentNumber());
            studentStorageService.requireQuota(sessionStudentNumber, file.getSize());
        }
        ExamPaperType examPaperType = validateExamMetadata(request);

        StudentEntity student = studentService.resolveOrCreate(
                request.studentNumber(),
                request.studentName(),
                request.faculty(),
                request.department(),
                usesArchivePlacementContext(role)
        );
        FolderEntity folder = archiveTreeService.resolveUploadFolder(request, student, examPaperType, role);
        validateStaffUploadPlacement(role, request, folder);

        Path studentRoot = archiveTreeService.resolveStoragePath(storageRoot, request, student, examPaperType, role);
        Files.createDirectories(studentRoot);

        String originalName = file.getOriginalFilename() == null || file.getOriginalFilename().isBlank()
                ? (isStudentProjectZip(request, file, fileBytes) ? "project.zip" : "document.pdf")
                : file.getOriginalFilename();
        String storedName = UUID.randomUUID() + "_" + sanitizeFileName(originalName);
        Path target = studentRoot.resolve(storedName);
        FileEncryptionService.EncryptedPayload encrypted = fileEncryptionService.encrypt(fileBytes);
        Files.write(target, encrypted.bytes(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        String coverPhotoStoredPath = null;
        if (coverPhoto != null && !coverPhoto.isEmpty()) {
            coverPhotoStoredPath = storeCoverPhoto(coverPhoto, studentRoot);
        }

        DocumentEntity entity = new DocumentEntity();
        entity.setTitle(resolveTitle(request, student, examPaperType));
        entity.setFileName(originalName);
        entity.setDocumentCode(buildDocumentCode(request, student.getStudentNumber(), originalName, examPaperType));
        entity.setOwnerName(student.getFullName());
        entity.setStudentNumber(student.getStudentNumber());
        entity.setDepartment(resolveDepartment(student, request));
        entity.setUploadedBy(request.uploadedBy().trim());
        entity.setUploadedByRole(role);
        entity.setDescription(trimToNull(request.description()));
        entity.setTags(trimToNull(request.tags()));
        entity.setGithubUrl(projectLinkValidator.normalizeGithubUrl(request.githubUrl()));
        entity.setExternalLinks(projectLinkValidator.normalizeExternalLinks(request.externalLinks()));
        entity.setCoverPhotoPath(coverPhotoStoredPath);
        entity.setExamType(examPaperType == null ? null : examPaperType.name());
        entity.setAcademicYear(trimToNull(request.academicYear()));
        entity.setSemester(trimToNull(request.semester()));
        entity.setCourse(trimToNull(request.course()));
        entity.setMarks(request.marks());
        entity.setExamRoom(trimToNull(request.examRoom()));
        entity.setFilePath(target.toString());
        entity.setEncrypted(fileEncryptionService.isEnabled());
        entity.setEncryptionIv(encrypted.ivBase64());
        entity.setMimeType(file.getContentType() == null || file.getContentType().isBlank()
                ? (isStudentProjectZip(request, file, fileBytes) ? "application/zip" : "application/pdf")
                : file.getContentType());
        entity.setFolderId(folder.getId());
        entity.setSizeBytes(file.getSize());
        entity.setPageCount(resolvePdfPageCount(fileBytes, request.pageCount()));
        entity.setIssueDate(request.issueDate() == null ? java.time.LocalDate.now() : request.issueDate());
        entity.setStarred(Boolean.FALSE);
        boolean studentFypSubmission = role == UserRole.STUDENT
                && request.category() == StudentDocumentCategory.FINAL_YEAR_PROJECT;
        // Registrar and other office uploads enter the archive immediately (no pending gate).
        entity.setStatus(studentFypSubmission ? DocumentStatus.PENDING : DocumentStatus.APPROVED);
        entity.setType(isStudentProjectZip(request, file, fileBytes) ? DocumentType.ZIP : DocumentType.PDF);
        entity.setCategory(request.category());
        entity.setCreatedAt(LocalDateTime.now());
        entity.setModifiedAt(LocalDateTime.now());

        DocumentEntity saved = documentRepository.save(entity);
        if (studentFypSubmission) {
            createLibrarianApprovalTask(saved);
            activityService.recordAction(
                    "Submitted final year project \"" + saved.getTitle() + "\" for librarian approval",
                    saved.getOwnerName(),
                    ActivityCategory.UPLOAD,
                    activityService.enrichScope(scopeForDocument(saved, UserRole.STUDENT, UserRole.LIBRARIAN), requestActor),
                    requestActor
            );
        } else {
            syncSearchIndex(saved);
            activityService.recordAction(
                    "Uploaded \"" + saved.getTitle() + "\"",
                    saved.getUploadedBy() == null || saved.getUploadedBy().isBlank()
                            ? (role == null ? "Archive user" : role.name())
                            : saved.getUploadedBy(),
                    ActivityCategory.UPLOAD,
                    activityService.enrichScope(scopeForDocument(saved, role, null), requestActor),
                    requestActor
            );
        }
        return toDetail(saved);
    }

    @Transactional
    public DocumentDetailResponse updatePendingFinalYearProject(
            Long id,
            UploadDocumentRequest request,
            MultipartFile file,
            MultipartFile coverPhoto,
            String rawRole,
            String rawStudentNumber
    ) throws IOException {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String sessionStudentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, sessionStudentNumber);
        if (role != UserRole.STUDENT) {
            throw new IllegalArgumentException("Only students can edit pending final year project submissions");
        }

        DocumentEntity entity = documentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));
        if (!accessService.isStudentDocument(entity, sessionStudentNumber)) {
            throw new IllegalArgumentException("Document not found: " + id);
        }
        if (entity.getCategory() != StudentDocumentCategory.FINAL_YEAR_PROJECT) {
            throw new IllegalArgumentException("Only final year project submissions can be edited here");
        }
        if (entity.getStatus() != DocumentStatus.PENDING && entity.getStatus() != DocumentStatus.REJECTED) {
            throw new IllegalArgumentException("Only pending or rejected submissions can be edited");
        }

        if (request.category() != null && request.category() != StudentDocumentCategory.FINAL_YEAR_PROJECT) {
            throw new IllegalArgumentException("Category cannot be changed for a final year project");
        }

        String title = trimToNull(request.projectTitle());
        if (title == null) {
            title = trimToNull(request.title());
        }
        if (title == null) {
            throw new IllegalArgumentException("Project title is required");
        }

        entity.setTitle(title);
        entity.setDescription(trimToNull(request.description()));
        entity.setGithubUrl(projectLinkValidator.normalizeGithubUrl(request.githubUrl()));
        entity.setExternalLinks(projectLinkValidator.normalizeExternalLinks(request.externalLinks()));
        entity.setDepartment(trimToNull(request.department()) == null ? entity.getDepartment() : request.department().trim());
        entity.setModifiedAt(LocalDateTime.now());
        entity.setStatus(DocumentStatus.PENDING);
        entity.setReviewNote(null);

        StudentEntity student = studentService.getStudentOrThrow(entity.getStudentNumber());
        ArchiveTreeService.StudentWorkspace workspace = archiveTreeService.ensureStudentWorkspace(student);
        entity.setFolderId(workspace.myProjectsPending().getId());

        Path studentRoot = Path.of(entity.getFilePath()).getParent();
        if (studentRoot == null) {
            studentRoot = storageRoot;
        }
        Files.createDirectories(studentRoot);

        if (file != null && !file.isEmpty()) {
            byte[] fileBytes = file.getBytes();
            validateUpload(request == null
                    ? new UploadDocumentRequest(
                    title,
                    entity.getStudentNumber(),
                    entity.getOwnerName(),
                    null,
                    entity.getDepartment(),
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    entity.getUploadedBy(),
                    StudentDocumentCategory.FINAL_YEAR_PROJECT,
                    1,
                    entity.getIssueDate(),
                    entity.getDescription(),
                    entity.getTags(),
                    entity.getGithubUrl(),
                    entity.getExternalLinks(),
                    title
            )
                    : request, file, fileBytes, role);
            if (fileBytes.length > FYP_ZIP_MAX_BYTES) {
                throw new IllegalArgumentException("Final year project ZIP must be 1 MB or smaller");
            }
            long delta = file.getSize() - (entity.getSizeBytes() == null ? 0L : entity.getSizeBytes());
            if (delta > 0) {
                studentStorageService.requireQuota(sessionStudentNumber, delta);
            }
            String originalName = file.getOriginalFilename() == null || file.getOriginalFilename().isBlank()
                    ? "project.zip"
                    : file.getOriginalFilename();
            String storedName = UUID.randomUUID() + "_" + sanitizeFileName(originalName);
            Path target = studentRoot.resolve(storedName);
            FileEncryptionService.EncryptedPayload encrypted = fileEncryptionService.encrypt(fileBytes);
            Files.write(target, encrypted.bytes(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            deleteQuietly(entity.getFilePath());
            entity.setFileName(originalName);
            entity.setFilePath(target.toString());
            entity.setEncrypted(fileEncryptionService.isEnabled());
            entity.setEncryptionIv(encrypted.ivBase64());
            entity.setMimeType(file.getContentType() == null || file.getContentType().isBlank()
                    ? "application/zip"
                    : file.getContentType());
            entity.setSizeBytes(file.getSize());
            entity.setType(DocumentType.ZIP);
        }

        if (coverPhoto != null && !coverPhoto.isEmpty()) {
            String coverPhotoStoredPath = storeCoverPhoto(coverPhoto, studentRoot);
            deleteQuietly(entity.getCoverPhotoPath());
            entity.setCoverPhotoPath(coverPhotoStoredPath);
        }

        DocumentEntity saved = documentRepository.save(entity);
        List<ApprovalTaskEntity> pendingTasks = approvalTaskRepository.findByDocumentIdAndStatus(saved.getId(), ApprovalStatus.PENDING);
        if (pendingTasks.isEmpty()) {
            createLibrarianApprovalTask(saved);
        } else {
            for (ApprovalTaskEntity task : pendingTasks) {
                task.setDocumentTitle(saved.getTitle());
                task.setRequestedAt(LocalDateTime.now());
                task.setDueAt(LocalDateTime.now().plusDays(7));
                task.setNote("Updated by student and awaiting librarian review");
                approvalTaskRepository.save(task);
            }
        }
        activityService.recordAction(
                "Updated final year project \"" + saved.getTitle() + "\" (pending librarian approval)",
                saved.getOwnerName(),
                ActivityCategory.UPLOAD,
                activityService.enrichScope(scopeForDocument(saved, UserRole.STUDENT, UserRole.LIBRARIAN), RequestActor.empty()),
                RequestActor.empty()
        );
        return toDetail(saved);
    }

    private void deleteQuietly(String pathValue) {
        if (pathValue == null || pathValue.isBlank()) {
            return;
        }
        try {
            Files.deleteIfExists(Path.of(pathValue));
        } catch (IOException ignored) {
            // Best-effort cleanup of replaced files.
        }
    }

    private ActivityScope scopeForDocument(DocumentEntity document, UserRole sourceRole, UserRole targetRole) {
        if (document == null) {
            return ActivityScope.empty();
        }
        return ActivityScope.builder()
                .sourceRole(sourceRole)
                .targetRole(targetRole)
                .academicDepartment(document.getDepartment())
                .documentCategory(document.getCategory())
                .studentNumber(document.getStudentNumber())
                .build();
    }

    private List<DocumentEntity> searchDocumentsFromStore(String trimmed, StudentDocumentCategory category) {
        if (documentElasticsearchService != null) {
            Optional<List<Long>> elasticIds = documentElasticsearchService.searchDocumentIds(trimmed, category);
            if (elasticIds.isPresent()) {
                return loadDocumentsByIds(elasticIds.get());
            }
        }

        List<DocumentEntity> documents = documentRepository.findByStudentNumberIgnoreCaseOrderByIssueDateDesc(trimmed);
        if (documents.isEmpty()) {
            documents = documentRepository.searchArchive(trimmed);
        }
        if (category != null) {
            documents = documents.stream()
                    .filter(document -> category.equals(document.getCategory()))
                    .toList();
        }
        return documents;
    }

    private List<DocumentEntity> loadDocumentsByIds(List<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Long, DocumentEntity> byId = documentRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(DocumentEntity::getId, Function.identity(), (left, right) -> left, LinkedHashMap::new));
        return ids.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .toList();
    }

    private void syncSearchIndex(DocumentEntity document) {
        if (documentElasticsearchService != null) {
            documentElasticsearchService.indexDocument(document);
        }
    }

    private void removeSearchIndex(Long documentId) {
        if (documentElasticsearchService != null) {
            documentElasticsearchService.deleteDocument(documentId);
        }
    }

    @Transactional
    public DocumentDetailResponse updateStatus(Long id, DocumentStatus status) {
        return updateStatus(id, status, null);
    }

    @Transactional
    public DocumentDetailResponse updateStatus(Long id, DocumentStatus status, String rawRole) {
        return updateStatus(id, status, null, rawRole);
    }

    @Transactional
    public DocumentDetailResponse updateStatus(Long id, DocumentStatus status, String reviewNote, String rawRole) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        DocumentEntity entity = documentRepository.findById(id)
                .filter(document -> folderService.isDocumentAccessible(document, role, null))
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));
        entity.setStatus(status);
        if (reviewNote != null && !reviewNote.isBlank()) {
            entity.setReviewNote(reviewNote.trim());
        }
        entity.setModifiedAt(LocalDateTime.now());

        if (entity.getCategory() == StudentDocumentCategory.FINAL_YEAR_PROJECT) {
            if (status == DocumentStatus.APPROVED) {
                placeApprovedFinalYearProject(entity);
            } else if (status == DocumentStatus.REJECTED) {
                placeRejectedFinalYearProject(entity);
            }
        }

        DocumentEntity saved = documentRepository.save(entity);
        if (status == DocumentStatus.APPROVED) {
            syncSearchIndex(saved);
        } else if (status == DocumentStatus.REJECTED || status == DocumentStatus.PENDING) {
            removeSearchIndex(saved.getId());
        } else {
            syncSearchIndex(saved);
        }
        return toDetail(saved);
    }

    private void placeApprovedFinalYearProject(DocumentEntity entity) {
        StudentEntity student = studentService.getStudentOrThrow(entity.getStudentNumber());
        FolderEntity profileFolder = archiveTreeService.createAcceptedProjectProfile(
                student,
                entity.getTitle(),
                entity.getId()
        );
        entity.setFolderId(profileFolder.getId());
        archiveTreeService.placeAcceptedProjectForLibrarian(
                student,
                entity.getTitle(),
                entity.getId()
        );
        archiveTreeService.placePublishedProject(
                student,
                entity.getTitle(),
                entity.getId()
        );
        archiveTreeService.ensureLibrarianReviewFolders();
    }

    private void placeRejectedFinalYearProject(DocumentEntity entity) {
        StudentEntity student = studentService.getStudentOrThrow(entity.getStudentNumber());
        FolderEntity studentRejectedFolder = archiveTreeService.placeRejectedProjectForStudent(
                student,
                entity.getTitle(),
                entity.getId()
        );
        entity.setFolderId(studentRejectedFolder.getId());
        archiveTreeService.placeRejectedProject(
                student,
                entity.getTitle(),
                entity.getId()
        );
    }

    @Transactional
    public void deleteDocument(Long id, String rawRole) {
        archiveDocument(id, rawRole);
    }

    @Transactional
    public DocumentDetailResponse replaceDocumentFile(
            Long id,
            MultipartFile file,
            String rawRole,
            String actorName
    ) throws IOException {
        return replaceDocumentFile(id, file, rawRole, actorName, RequestActor.empty());
    }

    @Transactional
    public DocumentDetailResponse replaceDocumentFile(
            Long id,
            MultipartFile file,
            String rawRole,
            String actorName,
            RequestActor requestActor
    ) throws IOException {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        if (role == UserRole.STUDENT) {
            throw new IllegalArgumentException("Students cannot replace staff archive documents here");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Replacement file is required");
        }
        DocumentEntity entity = documentRepository.findById(id)
                .filter(document -> !document.isArchivedForRemoval())
                .filter(document -> folderService.isDocumentAccessible(document, role, null))
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));
        folderService.requireDocumentShareAtLeast(entity, role, com.auca.archive.domain.SharePermission.EDIT);

        byte[] fileBytes = file.getBytes();
        if (fileBytes.length < 1) {
            throw new IllegalArgumentException("Replacement file is empty");
        }
        malwareScanService.requireClean(fileBytes, file.getOriginalFilename());

        DocumentType replacementType = resolveReplacementType(fileBytes);

        String originalName = file.getOriginalFilename() == null ? "document.pdf" : file.getOriginalFilename();
        Path previousPath = entity.getFilePath() == null || entity.getFilePath().isBlank()
                ? null
                : Path.of(entity.getFilePath());
        Path targetDirectory = previousPath != null && previousPath.getParent() != null
                ? previousPath.getParent()
                : storageRoot.resolve("replaced");
        Files.createDirectories(targetDirectory);

        FileEncryptionService.EncryptedPayload encrypted = fileEncryptionService.encrypt(fileBytes);
        String storedName = UUID.randomUUID() + "_" + sanitizeFileName(originalName);
        Path targetPath = targetDirectory.resolve(storedName);
        Files.write(targetPath, encrypted.bytes(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        entity.setFileName(sanitizeFileName(originalName));
        entity.setFilePath(targetPath.toString());
        entity.setMimeType(replacementType == DocumentType.ZIP ? "application/zip" : "application/pdf");
        entity.setSizeBytes((long) fileBytes.length);
        entity.setEncrypted(fileEncryptionService.isEnabled());
        entity.setEncryptionIv(encrypted.ivBase64());
        entity.setModifiedAt(LocalDateTime.now());
        if (actorName != null && !actorName.isBlank()) {
            entity.setUploadedBy(actorName);
        }
        entity.setType(replacementType);
        if (replacementType == DocumentType.PDF) {
            try (PDDocument pdfDocument = PDDocument.load(fileBytes)) {
                if (pdfDocument.getNumberOfPages() < 1) {
                    throw new IllegalArgumentException("Replacement PDF has no pages.");
                }
                entity.setPageCount(pdfDocument.getNumberOfPages());
            }
        }

        DocumentEntity saved = documentRepository.save(entity);
        if (previousPath != null) {
            try {
                Files.deleteIfExists(previousPath);
            } catch (IOException ignored) {
                // Best-effort cleanup of replaced files.
            }
        }
        syncSearchIndex(saved);
        activityService.recordAction(
                "Replaced file for \"" + saved.getTitle() + "\"",
                requestActor.resolvedActorLabel(actorName == null || actorName.isBlank() ? role.name() : actorName),
                ActivityCategory.UPLOAD,
                activityService.enrichScope(scopeForDocument(saved, role, null), requestActor),
                requestActor
        );
        return toDetail(saved);
    }

    @Transactional
    public void archiveDocument(Long id, String rawRole) {
        archiveDocument(id, rawRole, RequestActor.empty());
    }

    @Transactional
    public void archiveDocument(Long id, String rawRole, RequestActor requestActor) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        DocumentEntity entity = documentRepository.findById(id)
                .filter(document -> !document.isArchivedForRemoval())
                .filter(document -> folderService.isDocumentAccessible(document, role, null))
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));

        entity.setArchivedAt(LocalDateTime.now());
        entity.setArchivedBy(role.name());
        entity.setModifiedAt(LocalDateTime.now());
        DocumentEntity saved = documentRepository.save(entity);
        syncSearchIndex(saved);
        activityService.recordAction(
                "Moved \"" + entity.getTitle() + "\" to archive pending admin confirmation",
                entity.getArchivedBy(),
                ActivityCategory.ARCHIVE,
                activityService.enrichScope(scopeForDocument(saved, role, null), requestActor),
                requestActor
        );
    }

    @Transactional
    public void restoreDocument(Long id, String rawRole) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        DocumentEntity entity = documentRepository.findById(id)
                .filter(document -> document.isArchivedForRemoval())
                .filter(document -> folderService.isDocumentAccessible(document, role, null))
                .orElseThrow(() -> new IllegalArgumentException("Archived document not found: " + id));
        entity.setArchivedAt(null);
        entity.setArchivedBy(null);
        entity.setModifiedAt(LocalDateTime.now());
        DocumentEntity saved = documentRepository.save(entity);
        syncSearchIndex(saved);
    }

    @Transactional
    public void permanentlyDeleteDocument(Long id, String rawRole) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        accessService.requireAdmin(role);
        DocumentEntity entity = documentRepository.findById(id)
                .filter(document -> document.isArchivedForRemoval())
                .filter(document -> folderService.isDocumentAccessible(document, role, null))
                .orElseThrow(() -> new IllegalArgumentException("Archived document not found: " + id));

        if (entity.getFilePath() != null && !entity.getFilePath().isBlank()) {
            try {
                Files.deleteIfExists(Path.of(entity.getFilePath()));
            } catch (IOException ignored) {
                // File removal should not block database cleanup.
            }
        }
        Long documentId = entity.getId();
        documentRepository.delete(entity);
        removeSearchIndex(documentId);
    }

    private void validateUpload(UploadDocumentRequest request, MultipartFile file, byte[] fileBytes, UserRole role) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Document file is required");
        }
        if (request.category() == null) {
            if (!allowsNullUploadCategory(role)) {
                throw new IllegalArgumentException("Document category is required");
            }
        }
        if (fileBytes.length < minUploadSizeBytes) {
            throw new IllegalArgumentException("Document file is too small");
        }
        long maxBytes = role == UserRole.STUDENT ? studentMaxUploadSizeBytes : maxUploadSizeBytes;
        if (fileBytes.length > maxBytes) {
            throw new IllegalArgumentException(role == UserRole.STUDENT
                    ? "Student uploads are limited to 5 MB per file"
                    : "Document file is too large");
        }

        malwareScanService.requireClean(fileBytes, file.getOriginalFilename());

        if (isStudentProjectZip(request, file, fileBytes)) {
            FileSignatureValidator.requireZip(fileBytes);
            if (trimToNull(request.projectTitle()) == null && trimToNull(request.title()) == null) {
                throw new IllegalArgumentException("Project title is required");
            }
            if (fileBytes.length > FYP_ZIP_MAX_BYTES) {
                throw new IllegalArgumentException("Final year project ZIP must be 1 MB or smaller");
            }
            return;
        }

        FileSignatureValidator.requirePdf(fileBytes);
        if (request.pageCount() == null || request.pageCount() < 1) {
            throw new IllegalArgumentException("Page count is required");
        }
        if (request.issueDate() == null) {
            throw new IllegalArgumentException("Issue date is required");
        }

        try (PDDocument pdfDocument = PDDocument.load(fileBytes)) {
            int actualPages = pdfDocument.getNumberOfPages();
            if (actualPages < 1) {
                throw new IllegalArgumentException("PDF has no pages");
            }

            documentScanService.requireVerified(fileBytes, request, file.getOriginalFilename());
        }
    }

    private int resolvePdfPageCount(byte[] fileBytes, Integer requested) {
        try (PDDocument document = PDDocument.load(fileBytes)) {
            int actualPages = document.getNumberOfPages();
            if (actualPages > 0) {
                return actualPages;
            }
        } catch (IOException ignored) {
            // Fall back to the client-provided count.
        }
        return requested == null || requested < 1 ? 1 : requested;
    }

    private DocumentType resolveReplacementType(byte[] fileBytes) {
        if (FileSignatureValidator.isZip(fileBytes)) {
            FileSignatureValidator.requireZip(fileBytes);
            return DocumentType.ZIP;
        }
        if (FileSignatureValidator.isPdf(fileBytes)) {
            FileSignatureValidator.requirePdf(fileBytes);
            return DocumentType.PDF;
        }
        throw new IllegalArgumentException("Replacement file must be a PDF or ZIP archive.");
    }

    private boolean isStudentProjectZip(UploadDocumentRequest request, MultipartFile file, byte[] fileBytes) {
        if (request == null || request.category() != StudentDocumentCategory.FINAL_YEAR_PROJECT) {
            return false;
        }
        if (fileBytes != null && FileSignatureValidator.isZip(fileBytes)) {
            return true;
        }
        String originalName = file == null || file.getOriginalFilename() == null
                ? ""
                : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        String contentType = file == null || file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        return originalName.endsWith(".zip")
                || contentType.contains("zip");
    }

    private String storeCoverPhoto(MultipartFile coverPhoto, Path studentRoot) throws IOException {
        String originalName = coverPhoto.getOriginalFilename() == null ? "cover.jpg" : coverPhoto.getOriginalFilename();
        String lower = originalName.toLowerCase();
        if (!(lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp"))) {
            throw new IllegalArgumentException("Face photo must be a JPG, PNG, or WEBP image");
        }
        if (coverPhoto.getSize() > 2 * 1024 * 1024L) {
            throw new IllegalArgumentException("Face photo must be 2 MB or smaller");
        }
        byte[] bytes = coverPhoto.getBytes();
        FileSignatureValidator.requireImage(bytes);
        malwareScanService.requireClean(bytes, originalName);
        try (java.io.ByteArrayInputStream input = new java.io.ByteArrayInputStream(bytes)) {
            java.awt.image.BufferedImage image = javax.imageio.ImageIO.read(input);
            if (image == null) {
                throw new IllegalArgumentException("Face photo could not be read. Upload a clear photo of your face.");
            }
            if (image.getWidth() < 180 || image.getHeight() < 180) {
                throw new IllegalArgumentException("Face photo is too small. Use at least 180x180 pixels.");
            }
            // Reject extremely wide landscape banners that are unlikely to be a portrait face photo.
            if (image.getWidth() > image.getHeight() * 1.6) {
                throw new IllegalArgumentException("Upload a portrait face photo, not a wide landscape image.");
            }
        }
        String storedName = UUID.randomUUID() + "_cover_" + sanitizeFileName(originalName);
        Path target = studentRoot.resolve(storedName);
        Files.write(target, bytes, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        return target.toString();
    }

    private void createLibrarianApprovalTask(DocumentEntity document) {
        ApprovalTaskEntity task = new ApprovalTaskEntity();
        task.setDocumentId(document.getId());
        task.setDocumentTitle(document.getTitle());
        task.setRequestedBy(document.getOwnerName());
        task.setRequestedAt(LocalDateTime.now());
        task.setDueAt(LocalDateTime.now().plusDays(7));
        task.setNote("Awaiting librarian review for final year project archive");
        task.setPriority("High");
        task.setStatus(ApprovalStatus.PENDING);
        approvalTaskRepository.save(task);
    }

    private ExamPaperType validateExamMetadata(UploadDocumentRequest request) {
        if (!isExamUpload(request)) {
            return null;
        }

        String academicYear = trimToNull(request.academicYear());
        String semester = trimToNull(request.semester());
        if (academicYear == null) {
            throw new IllegalArgumentException("Academic year is required for exam papers");
        }
        if (semester == null) {
            throw new IllegalArgumentException("Semester is required for exam papers");
        }

        if (request.examType() == null || request.examType().isBlank()) {
            return null;
        }

        ExamPaperType examPaperType = ExamPaperType.from(request.examType());
        String course = trimToNull(request.course());
        String room = trimToNull(request.examRoom());
        Integer marks = request.marks();

        if (course == null) {
            throw new IllegalArgumentException("Course is required for exam papers");
        }
        if (room == null) {
            throw new IllegalArgumentException("Room is required for exam papers");
        }
        if (marks == null) {
            throw new IllegalArgumentException("Marks are required for exam papers");
        }
        if (marks < 0 || marks > examPaperType.getMaxMarks()) {
            throw new IllegalArgumentException("Marks must be between 0 and " + examPaperType.getMaxMarks()
                    + " for " + examPaperType.getDisplayName() + " papers");
        }

        return examPaperType;
    }

    private String buildDocumentCode(UploadDocumentRequest request, String studentNumber, String fileName, ExamPaperType examPaperType) {
        String cleanStudentNumber = studentNumber == null ? "STUDENT" : studentNumber.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
        String suffix = Integer.toHexString(Math.abs(fileName.hashCode())).toUpperCase();
        if (isExamUpload(request) && examPaperType != null) {
            return categoryFolderCode(request)
                    + "-"
                    + examPaperType.getFolderCode()
                    + "-"
                    + sanitizeCodeSegment(request.academicYear())
                    + "-"
                    + sanitizeCodeSegment(request.semester())
                    + "-"
                    + sanitizeCodeSegment(request.course())
                    + "-"
                    + cleanStudentNumber
                    + "-"
                    + suffix;
        }
        if (isExamUpload(request)) {
            return categoryFolderCode(request)
                    + "-"
                    + sanitizeCodeSegment(request.academicYear())
                    + "-"
                    + sanitizeCodeSegment(request.semester())
                    + "-"
                    + cleanStudentNumber
                    + "-"
                    + suffix;
        }
        return categoryFolderCode(request) + "-" + cleanStudentNumber + "-" + suffix;
    }

    private String categoryFolderCode(UploadDocumentRequest request) {
        return request.category() == null ? "DOC" : request.category().getFolderCode();
    }

    private boolean allowsNullUploadCategory(UserRole role) {
        return role == UserRole.REGISTRAR || role == UserRole.HOD;
    }

    private String sanitizeFileName(String fileName) {
        return fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String sanitizePathSegment(String value) {
        return value == null ? "UNKNOWN" : value.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String sanitizeCodeSegment(String value) {
        return sanitizePathSegment(value).replaceAll("[^A-Za-z0-9]", "").toUpperCase();
    }

    private DocumentListItemResponse toListItem(DocumentEntity document) {
        return new DocumentListItemResponse(
                document.getId(),
                document.getTitle(),
                document.getOwnerName(),
                document.getStudentNumber(),
                document.getDepartment(),
                document.getIssueDate(),
                document.getModifiedAt(),
                document.getStatus() == null ? null : document.getStatus().name(),
                document.getFileName(),
                document.getSizeBytes(),
                document.getPageCount(),
                document.getCategory() == null ? null : document.getCategory().name(),
                document.getType() == null ? null : document.getType().name(),
                resolveFolderName(document),
                document.getFolderId(),
                document.getStarred(),
                document.getExamType(),
                document.getAcademicYear(),
                document.getSemester(),
                document.getCourse(),
                document.getMarks(),
                document.getExamRoom(),
                document.getArchivedAt(),
                document.getArchivedBy(),
                document.getGithubUrl(),
                document.getExternalLinks(),
                document.getReviewNote(),
                document.getDescription(),
                document.getCoverPhotoPath() != null && !document.getCoverPhotoPath().isBlank()
        );
    }

    private DocumentDetailResponse toDetail(DocumentEntity document) {
        return toDetail(document, null, null);
    }

    private DocumentDetailResponse toDetail(DocumentEntity document, UserRole role, String studentNumber) {
        DocumentShareAccessContext access = folderService.resolveDocumentShareAccess(document, role, studentNumber);
        boolean allowDownload = access.allowDownload();
        return new DocumentDetailResponse(
                document.getId(),
                document.getTitle(),
                document.getFileName(),
                document.getDocumentCode(),
                document.getOwnerName(),
                document.getStudentNumber(),
                document.getDepartment(),
                document.getUploadedBy(),
                document.getDescription(),
                document.getTags(),
                document.getFilePath(),
                document.getMimeType(),
                document.getFolderId(),
                document.getSizeBytes(),
                document.getPageCount(),
                document.getIssueDate(),
                document.getStarred(),
                document.getCreatedAt(),
                document.getModifiedAt(),
                document.getStatus() == null ? null : document.getStatus().name(),
                document.getType() == null ? null : document.getType().name(),
                document.getCategory() == null ? null : document.getCategory().name(),
                document.getExamType(),
                document.getAcademicYear(),
                document.getSemester(),
                document.getCourse(),
                document.getMarks(),
                document.getExamRoom(),
                document.getGithubUrl(),
                document.getExternalLinks(),
                document.getReviewNote(),
                document.getCoverPhotoPath() == null || document.getCoverPhotoPath().isBlank()
                        ? null
                        : "/api/documents/" + document.getId() + "/cover",
                allowDownload ? "/api/documents/" + document.getId() + "/download" : null,
                allowDownload,
                access.shareExpiresAt(),
                access.accessViaShare(),
                access.sharePermission() == null ? null : access.sharePermission().name(),
                access.sharePermissionLabel()
        );
    }

    private String resolveFolderName(DocumentEntity document) {
        if (document.getFolderId() == null) {
            return document.getCategory() == null ? "Student Documents" : document.getCategory().getDisplayName();
        }
        try {
            return folderService.getFolderOrThrow(document.getFolderId()).getName();
        } catch (IllegalArgumentException ex) {
            return document.getCategory() == null ? "Student Documents" : document.getCategory().getDisplayName();
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeStudentNumber(String rawStudentNumber) {
        if (rawStudentNumber == null || rawStudentNumber.isBlank()) {
            return null;
        }
        return rawStudentNumber.trim();
    }

    private boolean usesArchivePlacementContext(UserRole role) {
        return role == UserRole.REGISTRAR
                || role == UserRole.EXAMINATION_OFFICER
                || role == UserRole.HOD
                || role == UserRole.LIBRARIAN;
    }

    private boolean isExamUpload(UploadDocumentRequest request) {
        return request.category() == StudentDocumentCategory.EXAMINATION_DOCUMENTS;
    }

    private String resolveTitle(UploadDocumentRequest request, StudentEntity student, ExamPaperType examPaperType) {
        if (isExamUpload(request) && examPaperType != null) {
            StringBuilder builder = new StringBuilder(examPaperType.getDisplayName());
            appendTitleSegment(builder, request.course());
            appendTitleSegment(builder, request.academicYear());
            appendTitleSegment(builder, request.semester());
            appendTitleSegment(builder, student.getStudentNumber());
            return builder.toString();
        }

        String explicitTitle = trimToNull(request.projectTitle());
        if (explicitTitle == null) {
            explicitTitle = trimToNull(request.title());
        }
        if (explicitTitle != null) {
            return explicitTitle;
        }
        if (request.category() == null) {
            return "Archived document";
            
        }
        if (isExamUpload(request)) {
            StringBuilder builder = new StringBuilder(request.category().getDisplayName());
            appendTitleSegment(builder, request.academicYear());
            appendTitleSegment(builder, request.semester());
            appendTitleSegment(builder, student.getStudentNumber());
            return builder.toString();
        }
        return request.category().getDisplayName();
    }

    private String resolveDepartment(StudentEntity student, UploadDocumentRequest request) {
        String studentDepartment = trimToNull(student.getDepartment());
        if (studentDepartment != null) {
            return studentDepartment;
        }
        return trimToNull(request.department());
    }

    private void appendTitleSegment(StringBuilder builder, String value) {
        String trimmed = trimToNull(value);
        if (trimmed != null) {
            builder.append(" - ").append(trimmed);
        }
    }

    private void requireReservationForPeerDownload(DocumentEntity document, UserRole role, String studentNumber) {
        if (role != UserRole.STUDENT
                || document.getCategory() != StudentDocumentCategory.FINAL_YEAR_PROJECT
                || document.getStatus() != DocumentStatus.APPROVED
                || accessService.isStudentDocument(document, studentNumber)) {
            return;
        }
        if (!folderService.isPublishedPeerDocument(document, studentNumber)) {
            return;
        }
        if (!reservationService.hasActiveReservation(document.getId(), studentNumber)) {
            throw new IllegalArgumentException(
                    "Reserve this book for a 20-minute reading slot before downloading."
            );
        }
    }

    private void validateStaffUploadPlacement(UserRole role, UploadDocumentRequest request, FolderEntity folder) {
        if (role == null || role == UserRole.STUDENT) {
            return;
        }
        String studentNumber = trimToNull(request.studentNumber());
        if (studentNumber == null) {
            throw new IllegalArgumentException(
                    "Student ID is required. Documents cannot be uploaded directly into a semester without a linked student folder."
            );
        }
        if (usesArchivePlacementContext(role)) {
            if (trimToNull(request.academicYear()) == null || trimToNull(request.semester()) == null) {
                throw new IllegalArgumentException(
                        "Open a semester folder and provide placement context before uploading for a student."
                );
            }
        }
        if (folder == null || !ArchiveTreeService.isSemesterStudentRootFolder(folder.getCode())) {
            throw new IllegalArgumentException(
                    "Upload must be stored inside the student's folder under the selected semester."
            );
        }
        if (folder.getName() == null || !folder.getName().trim().equalsIgnoreCase(studentNumber.trim())) {
            throw new IllegalArgumentException(
                    "Upload folder must match the student ID used for this document."
            );
        }
    }
}
