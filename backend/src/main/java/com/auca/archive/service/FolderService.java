package com.auca.archive.service;

import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.domain.DocumentType;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.DocumentListItemResponse;
import com.auca.archive.dto.FolderBreadcrumbResponse;
import com.auca.archive.dto.FolderDetailResponse;
import com.auca.archive.dto.FolderNodeResponse;
import com.auca.archive.dto.ShareFolderResponse;
import com.auca.archive.model.DocumentEntity;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.repository.DocumentRepository;
import com.auca.archive.repository.FolderRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class FolderService {
    private final FolderRepository folderRepository;
    private final DocumentRepository documentRepository;
    private final ArchiveAccessService accessService;
    private final ActivityService activityService;
    private final FileEncryptionService fileEncryptionService;
    private final Path storageRoot;

    public FolderService(
            FolderRepository folderRepository,
            DocumentRepository documentRepository,
            ArchiveAccessService accessService,
            ActivityService activityService,
            FileEncryptionService fileEncryptionService,
            @Value("${archive.storage-root:storage}") String storageRoot
    ) {
        this.folderRepository = folderRepository;
        this.documentRepository = documentRepository;
        this.accessService = accessService;
        this.activityService = activityService;
        this.fileEncryptionService = fileEncryptionService;
        this.storageRoot = Path.of(storageRoot).toAbsolutePath().normalize();
    }

    public List<FolderNodeResponse> getTree() {
        return getTree(null);
    }

    public List<FolderNodeResponse> getTree(String rawRole) {
        return getTree(rawRole, null);
    }

    public List<FolderNodeResponse> getTree(String rawRole, String rawStudentNumber) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);

        if (role == UserRole.STUDENT) {
            return getStudentPersonalTree(studentNumber);
        }

        List<FolderEntity> folders = folderRepository.findAll();
        Map<Long, FolderEntity> folderById = folders.stream()
                .collect(Collectors.toMap(FolderEntity::getId, Function.identity()));
        Map<Long, List<FolderEntity>> childrenByParent = groupFoldersByParent(folders);

        return childrenByParent.getOrDefault(null, List.of()).stream()
                .sorted(Comparator.comparing(FolderEntity::getName))
                .flatMap(folder -> toVisibleNodes(folder, childrenByParent, folderById, role, null, false).stream())
                .sorted(Comparator.comparing(FolderNodeResponse::name))
                .toList();
    }

    public FolderEntity getFolderOrThrow(Long id) {
        return folderRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Folder not found: " + id));
    }

    public FolderDetailResponse getFolderDetail(Long id, String rawRole) {
        return getFolderDetail(id, rawRole, null);
    }

    public FolderDetailResponse getFolderDetail(Long id, String rawRole, String rawStudentNumber) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        FolderEntity folder = getFolderOrThrow(id);
        if (!isFolderAccessible(folder, role, studentNumber)) {
            throw new IllegalArgumentException("Folder not found: " + id);
        }

        List<FolderEntity> folders = folderRepository.findAll();
        Map<Long, FolderEntity> folderById = folders.stream()
                .collect(Collectors.toMap(FolderEntity::getId, Function.identity()));
        Map<Long, List<FolderEntity>> childrenByParent = groupFoldersByParent(folders);

        List<FolderBreadcrumbResponse> breadcrumbs = buildBreadcrumbs(folder, folderById, role, studentNumber);
        List<FolderNodeResponse> children = childrenByParent.getOrDefault(folder.getId(), List.of()).stream()
                .sorted(Comparator.comparing(FolderEntity::getName))
                .flatMap(child -> toVisibleNodes(child, childrenByParent, folderById, role, studentNumber, isFolderVisibleByParent(folder, role, studentNumber)).stream())
                .toList();

        List<DocumentListItemResponse> documents = documentRepository
                .findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(folder.getId())
                .stream()
                .filter(document -> isDocumentAccessible(document, role, studentNumber))
                .map(this::toListItem)
                .toList();

        return new FolderDetailResponse(
                folder.getId(),
                folder.getName(),
                folder.getCode(),
                folder.getParentId(),
                breadcrumbs,
                countDocuments(folder, childrenByParent, role, studentNumber),
                children,
                documents
        );
    }

    public FolderEntity getFolderByCodeOrThrow(String code) {
        return folderRepository.findByCode(code)
                .orElseThrow(() -> new IllegalArgumentException("Folder not found for code: " + code));
    }

    public FolderEntity resolveOrCreateFolder(String name, String code, Long parentId) {
        return folderRepository.findByCode(code)
                .map(existing -> {
                    boolean changed = false;
                    if (!Objects.equals(existing.getName(), name)) {
                        existing.setName(name);
                        changed = true;
                    }
                    if (!Objects.equals(existing.getParentId(), parentId)) {
                        existing.setParentId(parentId);
                        changed = true;
                    }
                    return changed ? folderRepository.save(existing) : existing;
                })
                .orElseGet(() -> folderRepository.save(new FolderEntity(name, code, parentId)));
    }

    @Transactional
    public FolderNodeResponse createSubfolder(Long parentId, String name, String rawRole) {
        return createSubfolder(parentId, name, rawRole, null);
    }

    @Transactional
    public FolderNodeResponse createSubfolder(Long parentId, String name, String rawRole, String rawStudentNumber) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        FolderEntity parent = getFolderOrThrow(parentId);
        if (!isFolderAccessible(parent, role, studentNumber)) {
            throw new IllegalArgumentException("Folder not found: " + parentId);
        }
        if (role == UserRole.STUDENT && !canStudentCreateSubfolder(parent, studentNumber)) {
            throw new IllegalArgumentException("You can only create folders inside your personal project workspace");
        }
        if (role != UserRole.STUDENT) {
            requireStaffCreateTarget(parent, role);
        }

        String trimmedName = name == null ? "" : name.trim();
        if (trimmedName.isBlank()) {
            throw new IllegalArgumentException("Folder name is required");
        }

        String code = role == UserRole.STUDENT
                ? buildStudentPersonalFolderCode(parent, trimmedName)
                : "FLD-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
        FolderEntity folder = folderRepository.save(new FolderEntity(trimmedName, code, parentId));
        return new FolderNodeResponse(
                folder.getId(),
                folder.getName(),
                folder.getCode(),
                folder.getParentId(),
                0,
                List.of()
        );
    }

    @Transactional
    public FolderNodeResponse renameFolder(Long id, String name, String rawRole, String rawStudentNumber) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        FolderEntity folder = getFolderOrThrow(id);
        requireModifiableFolder(folder, role, studentNumber);

        String trimmedName = name == null ? "" : name.trim();
        if (trimmedName.isBlank()) {
            throw new IllegalArgumentException("Folder name is required");
        }
        folder.setName(trimmedName);
        FolderEntity saved = folderRepository.save(folder);
        return toNode(saved, role, studentNumber);
    }

    @Transactional
    public FolderNodeResponse moveFolder(Long id, Long targetParentId, String rawRole, String rawStudentNumber) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        FolderEntity folder = getFolderOrThrow(id);
        requireModifiableFolder(folder, role, studentNumber);

        FolderEntity targetParent = getFolderOrThrow(targetParentId);
        requirePasteTarget(targetParent, role, studentNumber);
        if (Objects.equals(id, targetParentId) || isDescendantOf(id, targetParentId)) {
            throw new IllegalArgumentException("A folder cannot be moved into itself or one of its subfolders");
        }

        folder.setParentId(targetParentId);
        FolderEntity saved = folderRepository.save(folder);
        return toNode(saved, role, studentNumber);
    }

    @Transactional
    public FolderNodeResponse copyFolder(Long id, Long targetParentId, String rawRole, String rawStudentNumber) throws IOException {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        FolderEntity folder = getFolderOrThrow(id);
        if (!isFolderAccessible(folder, role, studentNumber)) {
            throw new IllegalArgumentException("Folder not found: " + id);
        }
        if (isProtectedArchiveStructureFolder(folder)) {
            throw new IllegalArgumentException("Faculty and department folders are part of the system archive structure and cannot be copied");
        }

        FolderEntity targetParent = getFolderOrThrow(targetParentId);
        requirePasteTarget(targetParent, role, studentNumber);
        if (Objects.equals(id, targetParentId) || isDescendantOf(id, targetParentId)) {
            throw new IllegalArgumentException("A folder cannot be copied into itself or one of its subfolders");
        }

        Map<Long, List<FolderEntity>> childrenByParent = groupFoldersByParent(folderRepository.findAll());
        FolderEntity copied = copyFolderRecursively(folder, targetParentId, role, studentNumber, childrenByParent);
        return toNode(copied, role, studentNumber);
    }

    @Transactional
    public void deleteFolder(Long id, String rawRole) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        if (role == UserRole.STUDENT) {
            throw new IllegalArgumentException("Students cannot delete archive folders");
        }
        FolderEntity folder = getFolderOrThrow(id);
        if (!isFolderAccessible(folder, role)) {
            throw new IllegalArgumentException("Folder not found: " + id);
        }
        if (folder.getParentId() == null) {
            throw new IllegalArgumentException("System folders cannot be deleted");
        }
        if (isProtectedArchiveStructureFolder(folder)) {
            throw new IllegalArgumentException("Faculty and department folders are part of the system archive structure and cannot be deleted");
        }

        boolean hasChildren = folderRepository.findAll().stream()
                .anyMatch(candidate -> Objects.equals(candidate.getParentId(), id));
        if (hasChildren) {
            throw new IllegalArgumentException("Remove all subfolders before deleting this folder");
        }

        if (!documentRepository.findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(id).isEmpty()) {
            throw new IllegalArgumentException("Remove all documents before deleting this folder");
        }

        folderRepository.delete(folder);
    }

    public byte[] downloadAsZip(Long folderId, List<Long> documentIds, String rawRole) throws IOException {
        return downloadAsZip(folderId, documentIds, rawRole, null);
    }

    public byte[] downloadAsZip(Long folderId, List<Long> documentIds, String rawRole, String rawStudentNumber) throws IOException {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        FolderEntity folder = getFolderOrThrow(folderId);
        if (!isFolderAccessible(folder, role, studentNumber)) {
            throw new IllegalArgumentException("Folder not found: " + folderId);
        }

        List<DocumentEntity> documents;
        if (documentIds != null && !documentIds.isEmpty()) {
            documents = documentIds.stream()
                    .map(id -> documentRepository.findById(id)
                            .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id)))
                    .filter(document -> isDocumentAccessible(document, role, studentNumber))
                    .toList();
        } else {
            documents = documentRepository.findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(folderId).stream()
                    .filter(document -> isDocumentAccessible(document, role, studentNumber))
                    .toList();
        }

        if (documents.isEmpty()) {
            throw new IllegalArgumentException("No documents to download in this folder");
        }

        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        Set<String> usedNames = new HashSet<>();
        try (ZipOutputStream zip = new ZipOutputStream(buffer)) {
            for (DocumentEntity document : documents) {
                if (document.getFilePath() == null || document.getFilePath().isBlank()) {
                    continue;
                }
                Path path = Path.of(document.getFilePath());
                if (!Files.exists(path)) {
                    continue;
                }
                byte[] storedBytes = Files.readAllBytes(path);
                byte[] plainBytes = fileEncryptionService.decrypt(storedBytes, document.getEncryptionIv());
                String baseName = document.getFileName() == null || document.getFileName().isBlank()
                        ? "document-" + document.getId() + ".pdf"
                        : document.getFileName();
                String entryName = uniqueZipEntryName(usedNames, baseName);
                zip.putNextEntry(new ZipEntry(entryName));
                zip.write(plainBytes);
                zip.closeEntry();
            }
        }

        if (buffer.size() == 0) {
            throw new IllegalArgumentException("Stored files are unavailable for download");
        }
        return buffer.toByteArray();
    }

    public ShareFolderResponse shareFolder(Long folderId, String targetRoleRaw, String actorRoleRaw, String actorName) {
        UserRole actorRole = accessService.resolveRole(actorRoleRaw);
        if (actorRole == UserRole.STUDENT) {
            throw new IllegalArgumentException("Students cannot share archive folders");
        }
        UserRole targetRole = accessService.resolveRole(targetRoleRaw);
        validateShareTarget(actorRole, targetRole);

        FolderEntity folder = getFolderOrThrow(folderId);
        if (!isFolderAccessible(folder, actorRole)) {
            throw new IllegalArgumentException("Folder not found: " + folderId);
        }

        activityService.recordShare(folder.getName(), actorName, targetRole);
        String targetLabel = roleLabel(targetRole);
        String message = "Folder shared with " + targetLabel + ". They can open it from their archive workspace.";
        return new ShareFolderResponse(message, "#/folders/" + folderId, targetRole.name(), targetLabel);
    }

    public boolean folderHasContents(Long id, String rawRole) {
        return folderHasContents(id, rawRole, null);
    }

    public boolean folderHasContents(Long id, String rawRole, String rawStudentNumber) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        FolderEntity folder = getFolderOrThrow(id);
        if (!isFolderAccessible(folder, role, studentNumber)) {
            return false;
        }

        boolean hasSubfolders = folderRepository.findAll().stream()
                .anyMatch(candidate -> Objects.equals(candidate.getParentId(), id));
        if (hasSubfolders) {
            return true;
        }

        return !documentRepository.findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(id).stream()
                .filter(document -> isDocumentAccessible(document, role, studentNumber))
                .toList()
                .isEmpty();
    }

    private void validateShareTarget(UserRole source, UserRole target) {
        if (source == UserRole.ADMIN) {
            if (target == UserRole.ADMIN) {
                throw new IllegalArgumentException("Choose a department role to share with");
            }
            return;
        }

        List<UserRole> allowed = switch (source) {
            case REGISTRAR -> List.of(UserRole.EXAMINATION_OFFICER, UserRole.HOD);
            case EXAMINATION_OFFICER -> List.of(UserRole.REGISTRAR, UserRole.HOD);
            case HOD -> List.of(UserRole.REGISTRAR, UserRole.EXAMINATION_OFFICER);
            case LIBRARIAN -> List.of(UserRole.HOD, UserRole.REGISTRAR);
            default -> List.of();
        };

        if (!allowed.contains(target)) {
            throw new IllegalArgumentException("You cannot share to that role from your account");
        }
    }

    private String roleLabel(UserRole role) {
        return switch (role) {
            case ADMIN -> "System Administrator";
            case REGISTRAR -> "Registrar";
            case EXAMINATION_OFFICER -> "Examination Officer";
            case HOD -> "Head of Department";
            case LIBRARIAN -> "Librarian";
            case STUDENT -> "Student";
        };
    }

    private String uniqueZipEntryName(Set<String> usedNames, String fileName) {
        String sanitized = fileName.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (!usedNames.contains(sanitized)) {
            usedNames.add(sanitized);
            return sanitized;
        }

        int dot = sanitized.lastIndexOf('.');
        String base = dot > 0 ? sanitized.substring(0, dot) : sanitized;
        String extension = dot > 0 ? sanitized.substring(dot) : "";
        int counter = 2;
        String candidate;
        do {
            candidate = base + " (" + counter + ")" + extension;
            counter++;
        } while (usedNames.contains(candidate));
        usedNames.add(candidate);
        return candidate;
    }

    public boolean isFolderAccessible(FolderEntity folder, UserRole role) {
        return isFolderAccessible(folder, role, null);
    }

    public boolean isFolderAccessible(FolderEntity folder, UserRole role, String studentNumber) {
        if (role == null) {
            return true;
        }
        return isFolderAccessible(folder, role, studentNumber, new HashSet<>());
    }

    public boolean isDocumentAccessible(DocumentEntity document, UserRole role) {
        return isDocumentAccessible(document, role, null);
    }

    public boolean isDocumentAccessible(DocumentEntity document, UserRole role, String studentNumber) {
        if (role == UserRole.ADMIN || role == UserRole.LIBRARIAN) {
            return true;
        }
        if (role == UserRole.STUDENT) {
            return accessService.isStudentDocument(document, studentNumber);
        }
        if (role == null) {
            return true;
        }
        if (document == null) {
            return false;
        }
        // Pending/rejected final-year projects stay out of the shared staff archive until librarian approval.
        if (document.getCategory() == StudentDocumentCategory.FINAL_YEAR_PROJECT
                && document.getStatus() != DocumentStatus.APPROVED) {
            return false;
        }
        if (document.getFolderId() != null) {
            return folderRepository.findById(document.getFolderId())
                    .map(folder -> isFolderAccessible(folder, role))
                    .orElse(false);
        }

        return document.getCategory() != null && accessService.allowedUploadCategories(role).contains(document.getCategory());
    }

    private List<FolderNodeResponse> getStudentPersonalTree(String studentNumber) {
        List<FolderEntity> folders = folderRepository.findAll();
        String marker = accessService.studentFolderMarker(studentNumber);
        FolderEntity studentFolder = folders.stream()
                .filter(folder -> folder.getCode() != null && folder.getCode().toUpperCase().contains(marker))
                .findFirst()
                .orElse(null);

        if (studentFolder == null) {
            return List.of(new FolderNodeResponse(
                    -1L,
                    "My Workspace",
                    "STD-MY",
                    null,
                    0,
                    List.of()
            ));
        }

        Map<Long, List<FolderEntity>> childrenByParent = groupFoldersByParent(folders);
        return List.of(buildStudentNode(studentFolder, childrenByParent, studentNumber));
    }

    private FolderNodeResponse buildStudentNode(
            FolderEntity folder,
            Map<Long, List<FolderEntity>> childrenByParent,
            String studentNumber
    ) {
        List<FolderNodeResponse> children = childrenByParent.getOrDefault(folder.getId(), List.of()).stream()
                .sorted(Comparator.comparing(FolderEntity::getName))
                .map(child -> buildStudentNode(child, childrenByParent, studentNumber))
                .toList();
        long documentCount = documentRepository.findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(folder.getId()).stream()
                .filter(document -> accessService.isStudentDocument(document, studentNumber))
                .count();
        for (FolderNodeResponse child : children) {
            documentCount += child.itemCount();
        }
        return new FolderNodeResponse(
                folder.getId(),
                folder.getName(),
                folder.getCode(),
                folder.getParentId(),
                documentCount,
                children
        );
    }

    private List<FolderNodeResponse> toVisibleNodes(
            FolderEntity folder,
            Map<Long, List<FolderEntity>> childrenByParent,
            Map<Long, FolderEntity> folderById,
            UserRole role,
            String studentNumber,
            boolean parentVisible
    ) {
        boolean nodeVisible = role == null
                || parentVisible
                || (role == UserRole.STUDENT
                ? accessService.isStudentFolder(folder, studentNumber)
                : accessService.matchesRoleFolderCode(folder.getCode(), role));

        List<FolderNodeResponse> children = childrenByParent.getOrDefault(folder.getId(), List.of()).stream()
                .sorted(Comparator.comparing(FolderEntity::getName))
                .flatMap(child -> toVisibleNodes(child, childrenByParent, folderById, role, studentNumber, nodeVisible).stream())
                .toList();

        if (!nodeVisible) {
            return children;
        }

        return List.of(new FolderNodeResponse(
                folder.getId(),
                folder.getName(),
                folder.getCode(),
                folder.getParentId(),
                countDocuments(folder, childrenByParent, role, studentNumber),
                children
        ));
    }

    private long countDocuments(FolderEntity folder, Map<Long, List<FolderEntity>> childrenByParent, UserRole role, String studentNumber) {
        long total = documentRepository.findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(folder.getId()).stream()
                .filter(document -> isDocumentAccessible(document, role, studentNumber))
                .count();
        for (FolderEntity child : childrenByParent.getOrDefault(folder.getId(), List.of())) {
            total += countDocuments(child, childrenByParent, role, studentNumber);
        }
        return total;
    }

    private List<FolderBreadcrumbResponse> buildBreadcrumbs(
            FolderEntity folder,
            Map<Long, FolderEntity> folderById,
            UserRole role,
            String studentNumber
    ) {
        ArrayDeque<FolderBreadcrumbResponse> breadcrumbs = new ArrayDeque<>();
        FolderEntity current = folder;
        Set<Long> visited = new HashSet<>();
        while (current != null && visited.add(current.getId())) {
            if (isFolderAccessible(current, role, studentNumber)) {
                breadcrumbs.push(new FolderBreadcrumbResponse(current.getId(), current.getName(), current.getCode()));
            }
            if (current.getParentId() == null) {
                break;
            }
            current = folderById.get(current.getParentId());
        }
        return new ArrayList<>(breadcrumbs);
    }

    private boolean isFolderAccessible(FolderEntity folder, UserRole role, String studentNumber, Set<Long> visited) {
        if (role == UserRole.ADMIN) {
            return true;
        }
        if (role == UserRole.STUDENT) {
            return accessService.isStudentFolder(folder, studentNumber);
        }
        if (folder == null) {
            return false;
        }
        if (!visited.add(folder.getId())) {
            return false;
        }
        if (accessService.matchesRoleFolderCode(folder.getCode(), role)) {
            return true;
        }
        if (folder.getParentId() == null) {
            return false;
        }
        return folderRepository.findById(folder.getParentId())
                .map(parent -> isFolderAccessible(parent, role, studentNumber, visited))
                .orElse(false);
    }

    private boolean isFolderVisibleByParent(FolderEntity folder, UserRole role, String studentNumber) {
        return isFolderAccessible(folder, role, studentNumber);
    }

    private String normalizeStudentNumber(String rawStudentNumber) {
        if (rawStudentNumber == null || rawStudentNumber.isBlank()) {
            return null;
        }
        return rawStudentNumber.trim();
    }

    private boolean canStudentCreateSubfolder(FolderEntity parent, String studentNumber) {
        if (parent == null || studentNumber == null || studentNumber.isBlank()) {
            return false;
        }
        if (!isWithinStudentTree(parent, studentNumber)) {
            return false;
        }
        String code = parent.getCode() == null ? "" : parent.getCode().toUpperCase(Locale.ROOT);
        return !isRegistrarCategoryFolder(code);
    }

    private boolean isWithinStudentTree(FolderEntity folder, String studentNumber) {
        String marker = accessService.studentFolderMarker(studentNumber);
        FolderEntity current = folder;
        Set<Long> visited = new HashSet<>();
        while (current != null && visited.add(current.getId())) {
            String code = current.getCode() == null ? "" : current.getCode().toUpperCase(Locale.ROOT);
            if (code.contains(marker)) {
                return true;
            }
            if (current.getParentId() == null) {
                return false;
            }
            current = folderRepository.findById(current.getParentId()).orElse(null);
        }
        return false;
    }

    private boolean isRegistrarCategoryFolder(String code) {
        return code.endsWith("-SREG")
                || code.endsWith("-SRIN")
                || code.endsWith("-SAPP")
                || code.endsWith("-SEXM");
    }

    private boolean isFacultyFolder(FolderEntity folder) {
        if (folder == null || folder.getCode() == null) {
            return false;
        }
        String code = folder.getCode().toUpperCase(Locale.ROOT);
        return code.matches("^FAC-[A-Z0-9]+$");
    }

    private boolean isDepartmentFolder(FolderEntity folder) {
        if (folder == null || folder.getCode() == null) {
            return false;
        }
        String code = folder.getCode().toUpperCase(Locale.ROOT);
        return code.matches("^FAC-[A-Z0-9]+-DEPT-[A-Z0-9]+$");
    }

    private boolean isProtectedArchiveStructureFolder(FolderEntity folder) {
        if (folder == null || folder.getParentId() == null) {
            return true;
        }
        return isFacultyFolder(folder) || isDepartmentFolder(folder);
    }

    private void requireStaffCreateTarget(FolderEntity parent, UserRole role) {
        if (parent.getParentId() == null) {
            throw new IllegalArgumentException("Folders cannot be created at the archive root");
        }
        if (isFacultyFolder(parent)) {
            throw new IllegalArgumentException("Folders cannot be created directly under a faculty");
        }
        if (isDepartmentFolder(parent) && !isAdminStaff(role)) {
            throw new IllegalArgumentException("Only administrators can create folders directly under a department");
        }
    }

    private boolean isAdminStaff(UserRole role) {
        return role == UserRole.ADMIN;
    }

    private void requireModifiableFolder(FolderEntity folder, UserRole role, String studentNumber) {
        if (folder.getParentId() == null) {
            throw new IllegalArgumentException("System folders cannot be changed");
        }
        if (isProtectedArchiveStructureFolder(folder)) {
            throw new IllegalArgumentException("Faculty and department folders are part of the system archive structure and cannot be changed");
        }
        if (!isFolderAccessible(folder, role, studentNumber)) {
            throw new IllegalArgumentException("Folder not found: " + folder.getId());
        }
        if (role == UserRole.STUDENT && !canStudentModifyFolder(folder, studentNumber)) {
            throw new IllegalArgumentException("You can only change folders in your personal project workspace");
        }
    }

    private void requirePasteTarget(FolderEntity targetParent, UserRole role, String studentNumber) {
        if (!isFolderAccessible(targetParent, role, studentNumber)) {
            throw new IllegalArgumentException("Destination folder not found: " + targetParent.getId());
        }
        if (role == UserRole.STUDENT && !canStudentCreateSubfolder(targetParent, studentNumber)) {
            throw new IllegalArgumentException("You can only paste folders inside your personal project workspace");
        }
    }

    private boolean canStudentModifyFolder(FolderEntity folder, String studentNumber) {
        if (folder == null || studentNumber == null || studentNumber.isBlank() || folder.getParentId() == null) {
            return false;
        }
        if (!isWithinStudentTree(folder, studentNumber)) {
            return false;
        }
        String code = folder.getCode() == null ? "" : folder.getCode().toUpperCase(Locale.ROOT);
        if (isRegistrarCategoryFolder(code)) {
            return false;
        }
        return code.contains("-MY-");
    }

    private boolean isDescendantOf(Long ancestorId, Long candidateId) {
        FolderEntity current = folderRepository.findById(candidateId).orElse(null);
        Set<Long> visited = new HashSet<>();
        while (current != null && visited.add(current.getId())) {
            if (Objects.equals(current.getId(), ancestorId)) {
                return true;
            }
            if (current.getParentId() == null) {
                break;
            }
            current = folderRepository.findById(current.getParentId()).orElse(null);
        }
        return false;
    }

    private FolderNodeResponse toNode(FolderEntity folder, UserRole role, String studentNumber) {
        Map<Long, List<FolderEntity>> childrenByParent = groupFoldersByParent(folderRepository.findAll());
        return new FolderNodeResponse(
                folder.getId(),
                folder.getName(),
                folder.getCode(),
                folder.getParentId(),
                countDocuments(folder, childrenByParent, role, studentNumber),
                List.of()
        );
    }

    private String resolveUniqueFolderName(Long parentId, String desiredName) {
        Set<String> siblingNames = folderRepository.findAll().stream()
                .filter(candidate -> Objects.equals(candidate.getParentId(), parentId))
                .map(FolderEntity::getName)
                .map(name -> name == null ? "" : name.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        String baseName = desiredName == null ? "Folder" : desiredName.trim();
        if (baseName.isBlank()) {
            baseName = "Folder";
        }
        if (!siblingNames.contains(baseName.toLowerCase(Locale.ROOT))) {
            return baseName;
        }
        int counter = 2;
        String candidateName;
        do {
            candidateName = baseName + " (" + counter + ")";
            counter++;
        } while (siblingNames.contains(candidateName.toLowerCase(Locale.ROOT)));
        return candidateName;
    }

    private FolderEntity copyFolderRecursively(
            FolderEntity source,
            Long targetParentId,
            UserRole role,
            String studentNumber,
            Map<Long, List<FolderEntity>> childrenByParent
    ) throws IOException {
        FolderEntity targetParent = getFolderOrThrow(targetParentId);
        String uniqueName = resolveUniqueFolderName(targetParentId, source.getName());
        String code = role == UserRole.STUDENT
                ? buildStudentPersonalFolderCode(targetParent, uniqueName)
                : "FLD-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase(Locale.ROOT);
        FolderEntity copied = folderRepository.save(new FolderEntity(uniqueName, code, targetParentId));

        for (DocumentEntity document : documentRepository.findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(source.getId())) {
            if (isDocumentAccessible(document, role, studentNumber)) {
                copyDocument(document, copied.getId());
            }
        }

        for (FolderEntity child : childrenByParent.getOrDefault(source.getId(), List.of())) {
            copyFolderRecursively(child, copied.getId(), role, studentNumber, childrenByParent);
        }
        return copied;
    }

    private void copyDocument(DocumentEntity source, Long targetFolderId) throws IOException {
        if (source.getFilePath() == null || source.getFilePath().isBlank()) {
            return;
        }
        Path sourcePath = Path.of(source.getFilePath());
        if (!Files.exists(sourcePath)) {
            return;
        }

        byte[] storedBytes = Files.readAllBytes(sourcePath);
        byte[] plainBytes = fileEncryptionService.decrypt(storedBytes, source.getEncryptionIv());
        FileEncryptionService.EncryptedPayload encrypted = fileEncryptionService.encrypt(plainBytes);

        Path targetDirectory = sourcePath.getParent();
        if (targetDirectory == null) {
            targetDirectory = storageRoot;
        }
        Files.createDirectories(targetDirectory);
        String storedName = UUID.randomUUID() + "_" + sanitizeFileName(source.getFileName());
        Path targetPath = targetDirectory.resolve(storedName);
        Files.write(targetPath, encrypted.bytes(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        DocumentEntity copy = new DocumentEntity();
        copy.setTitle(source.getTitle());
        copy.setFileName(source.getFileName());
        copy.setDocumentCode(source.getDocumentCode() + "-COPY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT));
        copy.setOwnerName(source.getOwnerName());
        copy.setStudentNumber(source.getStudentNumber());
        copy.setDepartment(source.getDepartment());
        copy.setUploadedBy(source.getUploadedBy());
        copy.setDescription(source.getDescription());
        copy.setTags(source.getTags());
        copy.setExamType(source.getExamType());
        copy.setAcademicYear(source.getAcademicYear());
        copy.setSemester(source.getSemester());
        copy.setCourse(source.getCourse());
        copy.setMarks(source.getMarks());
        copy.setExamRoom(source.getExamRoom());
        copy.setFilePath(targetPath.toString());
        copy.setMimeType(source.getMimeType());
        copy.setFolderId(targetFolderId);
        copy.setSizeBytes(source.getSizeBytes());
        copy.setPageCount(source.getPageCount());
        copy.setIssueDate(source.getIssueDate());
        copy.setStarred(Boolean.FALSE);
        copy.setStatus(source.getStatus() == null ? DocumentStatus.PENDING : source.getStatus());
        copy.setType(source.getType() == null ? DocumentType.PDF : source.getType());
        copy.setCategory(source.getCategory());
        copy.setEncrypted(fileEncryptionService.isEnabled());
        copy.setEncryptionIv(encrypted.ivBase64());
        copy.setCreatedAt(LocalDateTime.now());
        copy.setModifiedAt(LocalDateTime.now());
        documentRepository.save(copy);
    }

    private String sanitizeFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "document.pdf";
        }
        return fileName.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private String buildStudentPersonalFolderCode(FolderEntity parent, String folderName) {
        String suffix = folderName.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        if (suffix.isBlank()) {
            suffix = "PERSONAL";
        }
        return parent.getCode() + "-MY-" + suffix + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase(Locale.ROOT);
    }

    private void collectFolderIds(FolderEntity folder, Map<Long, List<FolderEntity>> childrenByParent, List<Long> folderIds) {
        folderIds.add(folder.getId());
        for (FolderEntity child : childrenByParent.getOrDefault(folder.getId(), List.of())) {
            collectFolderIds(child, childrenByParent, folderIds);
        }
    }

    private Map<Long, List<FolderEntity>> groupFoldersByParent(List<FolderEntity> folders) {
        Map<Long, List<FolderEntity>> grouped = new java.util.HashMap<>();
        for (FolderEntity folder : folders) {
            grouped.computeIfAbsent(folder.getParentId(), ignored -> new ArrayList<>()).add(folder);
        }
        return grouped;
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
                document.getFolderId() == null
                        ? "Student Documents"
                        : folderRepository.findById(document.getFolderId())
                                .map(FolderEntity::getName)
                                .orElse("Student Documents"),
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
                document.getReviewNote()
        );
    }
}
