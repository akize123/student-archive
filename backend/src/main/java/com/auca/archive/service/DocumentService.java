package com.auca.archive.service;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.domain.DocumentType;
import com.auca.archive.domain.ExamPaperType;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.DocumentDetailResponse;
import com.auca.archive.dto.DocumentListItemResponse;
import com.auca.archive.dto.UploadDocumentRequest;
import com.auca.archive.model.DocumentEntity;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.model.StudentEntity;
import com.auca.archive.repository.DocumentRepository;
import jakarta.transaction.Transactional;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class DocumentService {
    private static final float PAGE_SIZE_TOLERANCE = 12f;
    private static final float A4_WIDTH = 595f;
    private static final float A4_HEIGHT = 842f;
    private static final float LETTER_WIDTH = 612f;
    private static final float LETTER_HEIGHT = 792f;

    private final DocumentRepository documentRepository;
    private final FolderService folderService;
    private final StudentService studentService;
    private final ArchiveAccessService accessService;
    private final DocumentScanService documentScanService;
    private final ArchiveTreeService archiveTreeService;
    private final FileEncryptionService fileEncryptionService;
    private final ActivityService activityService;
    private final DocumentElasticsearchService documentElasticsearchService;
    private final Path storageRoot;
    private final long minUploadSizeBytes;
    private final long maxUploadSizeBytes;

    public DocumentService(
            DocumentRepository documentRepository,
            FolderService folderService,
            StudentService studentService,
            ArchiveAccessService accessService,
            DocumentScanService documentScanService,
            ArchiveTreeService archiveTreeService,
            FileEncryptionService fileEncryptionService,
            ActivityService activityService,
            @org.springframework.beans.factory.annotation.Autowired(required = false)
            DocumentElasticsearchService documentElasticsearchService,
            @Value("${archive.min-upload-size-bytes:1024}") long minUploadSizeBytes,
            @Value("${archive.max-upload-size-bytes:10485760}") long maxUploadSizeBytes,
            @Value("${archive.storage-root:storage}") String storageRoot
    ) {
        this.documentRepository = documentRepository;
        this.folderService = folderService;
        this.studentService = studentService;
        this.accessService = accessService;
        this.documentScanService = documentScanService;
        this.archiveTreeService = archiveTreeService;
        this.fileEncryptionService = fileEncryptionService;
        this.activityService = activityService;
        this.documentElasticsearchService = documentElasticsearchService;
        this.storageRoot = Path.of(storageRoot).toAbsolutePath().normalize();
        this.minUploadSizeBytes = minUploadSizeBytes;
        this.maxUploadSizeBytes = maxUploadSizeBytes;
    }

    public List<DocumentListItemResponse> search(String query) {
        return search(query, null, null);
    }

    public List<DocumentListItemResponse> search(String query, StudentDocumentCategory category) {
        return search(query, category, null);
    }

    public List<DocumentListItemResponse> search(String query, StudentDocumentCategory category, String rawRole) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        boolean hasQuery = query != null && !query.isBlank();
        List<DocumentEntity> documents;

        if (!hasQuery) {
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
                .filter(document -> folderService.isDocumentAccessible(document, role))
                .map(this::toListItem)
                .toList();
    }

    public List<DocumentListItemResponse> listArchived(String rawRole) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        List<DocumentEntity> documents = role == UserRole.ADMIN
                ? documentRepository.findByArchivedAtIsNotNullOrderByArchivedAtDesc()
                : documentRepository.findByArchivedAtIsNotNullAndArchivedByOrderByArchivedAtDesc(role.name());
        return documents.stream()
                .filter(document -> folderService.isDocumentAccessible(document, role))
                .map(this::toListItem)
                .toList();
    }

    public DocumentDetailResponse getDocument(Long id) {
        return getDocument(id, null);
    }

    public DocumentDetailResponse getDocument(Long id, String rawRole) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        return toDetail(documentRepository.findById(id)
                .filter(document -> !document.isArchivedForRemoval())
                .filter(document -> folderService.isDocumentAccessible(document, role))
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id)));
    }

    public Resource download(Long id) throws IOException {
        return download(id, null);
    }

    public Resource download(Long id, String rawRole) throws IOException {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        DocumentEntity document = documentRepository.findById(id)
                .filter(entity -> !entity.isArchivedForRemoval())
                .filter(entity -> folderService.isDocumentAccessible(entity, role))
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));
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

    @Transactional
    public DocumentDetailResponse upload(UploadDocumentRequest request, MultipartFile file) throws IOException {
        return upload(request, file, null);
    }

    @Transactional
    public DocumentDetailResponse upload(UploadDocumentRequest request, MultipartFile file, String rawRole) throws IOException {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Document file is required");
        }
        byte[] fileBytes = file.getBytes();
        validateUpload(request, file, fileBytes);
        if (!accessService.canUploadCategory(role, request.category())) {
            throw new IllegalArgumentException("You are not allowed to upload this document category");
        }
        ExamPaperType examPaperType = validateExamMetadata(request);

        StudentEntity student = studentService.resolveOrCreate(
                request.studentNumber(),
                request.studentName(),
                request.faculty(),
                request.department()
        );
        FolderEntity folder = archiveTreeService.resolveUploadFolder(request, student, examPaperType);

        Path studentRoot = archiveTreeService.resolveStoragePath(storageRoot, request, student, examPaperType);
        Files.createDirectories(studentRoot);

        String originalName = file.getOriginalFilename() == null || file.getOriginalFilename().isBlank()
                ? "document.pdf"
                : file.getOriginalFilename();
        String storedName = UUID.randomUUID() + "_" + sanitizeFileName(originalName);
        Path target = studentRoot.resolve(storedName);
        FileEncryptionService.EncryptedPayload encrypted = fileEncryptionService.encrypt(fileBytes);
        Files.write(target, encrypted.bytes(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        DocumentEntity entity = new DocumentEntity();
        entity.setTitle(resolveTitle(request, student, examPaperType));
        entity.setFileName(originalName);
        entity.setDocumentCode(buildDocumentCode(request, student.getStudentNumber(), originalName, examPaperType));
        entity.setOwnerName(student.getFullName());
        entity.setStudentNumber(student.getStudentNumber());
        entity.setDepartment(resolveDepartment(student, request));
        entity.setUploadedBy(request.uploadedBy().trim());
        entity.setDescription(trimToNull(request.description()));
        entity.setTags(trimToNull(request.tags()));
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
                ? "application/pdf"
                : file.getContentType());
        entity.setFolderId(folder.getId());
        entity.setSizeBytes(file.getSize());
        entity.setPageCount(request.pageCount());
        entity.setIssueDate(request.issueDate());
        entity.setStarred(Boolean.FALSE);
        entity.setStatus(DocumentStatus.PENDING);
        entity.setType(DocumentType.PDF);
        entity.setCategory(request.category());
        entity.setCreatedAt(LocalDateTime.now());
        entity.setModifiedAt(LocalDateTime.now());

        DocumentEntity saved = documentRepository.save(entity);
        syncSearchIndex(saved);
        return toDetail(saved);
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
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        DocumentEntity entity = documentRepository.findById(id)
                .filter(document -> folderService.isDocumentAccessible(document, role))
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));
        entity.setStatus(status);
        entity.setModifiedAt(LocalDateTime.now());
        DocumentEntity saved = documentRepository.save(entity);
        syncSearchIndex(saved);
        return toDetail(saved);
    }

    @Transactional
    public void deleteDocument(Long id, String rawRole) {
        archiveDocument(id, rawRole);
    }

    @Transactional
    public void archiveDocument(Long id, String rawRole) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        DocumentEntity entity = documentRepository.findById(id)
                .filter(document -> !document.isArchivedForRemoval())
                .filter(document -> folderService.isDocumentAccessible(document, role))
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));

        entity.setArchivedAt(LocalDateTime.now());
        entity.setArchivedBy(role.name());
        entity.setModifiedAt(LocalDateTime.now());
        DocumentEntity saved = documentRepository.save(entity);
        syncSearchIndex(saved);
        activityService.recordAction(
                "Moved \"" + entity.getTitle() + "\" to archive pending admin confirmation",
                entity.getArchivedBy(),
                ActivityCategory.ARCHIVE
        );
    }

    @Transactional
    public void restoreDocument(Long id, String rawRole) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        DocumentEntity entity = documentRepository.findById(id)
                .filter(document -> document.isArchivedForRemoval())
                .filter(document -> folderService.isDocumentAccessible(document, role))
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
                .filter(document -> folderService.isDocumentAccessible(document, role))
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

    private void validateUpload(UploadDocumentRequest request, MultipartFile file, byte[] fileBytes) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Document file is required");
        }
        if (request.category() == null) {
            throw new IllegalArgumentException("Document category is required");
        }
        if (fileBytes.length < minUploadSizeBytes) {
            throw new IllegalArgumentException("Document file is too small");
        }
        if (fileBytes.length > maxUploadSizeBytes) {
            throw new IllegalArgumentException("Document file is too large");
        }

        String originalName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        if (!originalName.endsWith(".pdf")) {
            throw new IllegalArgumentException("Only PDF documents are supported");
        }

        try (PDDocument pdfDocument = PDDocument.load(fileBytes)) {
            int actualPages = pdfDocument.getNumberOfPages();
            if (!request.pageCount().equals(actualPages)) {
                throw new IllegalArgumentException("Page count must match the uploaded PDF. Expected "
                        + request.pageCount() + " pages but found " + actualPages + ".");
            }

            int pageNumber = 1;
            for (PDPage page : pdfDocument.getPages()) {
                if (!isNormalPageSize(page.getMediaBox())) {
                    throw new IllegalArgumentException("Only A4 or Letter page sizes are allowed. Page "
                            + pageNumber + " is not a normal size.");
                }
                pageNumber++;
            }

            documentScanService.requireVerified(fileBytes, request);
        }
    }

    private ExamPaperType validateExamMetadata(UploadDocumentRequest request) {
        if (!isExamUpload(request)) {
            return null;
        }

        ExamPaperType examPaperType = ExamPaperType.from(request.examType());
        String academicYear = trimToNull(request.academicYear());
        String semester = trimToNull(request.semester());
        String course = trimToNull(request.course());
        String room = trimToNull(request.examRoom());
        Integer marks = request.marks();

        if (academicYear == null) {
            throw new IllegalArgumentException("Academic year is required for exam papers");
        }
        if (semester == null) {
            throw new IllegalArgumentException("Semester is required for exam papers");
        }
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
            return request.category().getFolderCode()
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
        return request.category().getFolderCode() + "-" + cleanStudentNumber + "-" + suffix;
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
                document.getStarred(),
                document.getExamType(),
                document.getAcademicYear(),
                document.getSemester(),
                document.getCourse(),
                document.getMarks(),
                document.getExamRoom(),
                document.getArchivedAt(),
                document.getArchivedBy()
        );
    }

    private DocumentDetailResponse toDetail(DocumentEntity document) {
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
                "/api/documents/" + document.getId() + "/download"
        );
    }

    private boolean isNormalPageSize(PDRectangle box) {
        if (box == null) {
            return false;
        }
        float width = box.getWidth();
        float height = box.getHeight();
        return matchesPageSize(width, height, A4_WIDTH, A4_HEIGHT)
                || matchesPageSize(width, height, A4_HEIGHT, A4_WIDTH)
                || matchesPageSize(width, height, LETTER_WIDTH, LETTER_HEIGHT)
                || matchesPageSize(width, height, LETTER_HEIGHT, LETTER_WIDTH);
    }

    private boolean matchesPageSize(float width, float height, float expectedWidth, float expectedHeight) {
        return Math.abs(width - expectedWidth) <= PAGE_SIZE_TOLERANCE
                && Math.abs(height - expectedHeight) <= PAGE_SIZE_TOLERANCE;
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

        String explicitTitle = trimToNull(request.title());
        if (explicitTitle != null) {
            return explicitTitle;
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
}
