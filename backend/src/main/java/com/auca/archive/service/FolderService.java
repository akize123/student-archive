package com.auca.archive.service;

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
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
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

    public FolderService(
            FolderRepository folderRepository,
            DocumentRepository documentRepository,
            ArchiveAccessService accessService,
            ActivityService activityService,
            FileEncryptionService fileEncryptionService
    ) {
        this.folderRepository = folderRepository;
        this.documentRepository = documentRepository;
        this.accessService = accessService;
        this.activityService = activityService;
        this.fileEncryptionService = fileEncryptionService;
    }

    public List<FolderNodeResponse> getTree() {
        return getTree(null);
    }

    public List<FolderNodeResponse> getTree(String rawRole) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        List<FolderEntity> folders = folderRepository.findAll();
        Map<Long, FolderEntity> folderById = folders.stream()
                .collect(Collectors.toMap(FolderEntity::getId, Function.identity()));
        Map<Long, List<FolderEntity>> childrenByParent = groupFoldersByParent(folders);

        return childrenByParent.getOrDefault(null, List.of()).stream()
                .sorted(Comparator.comparing(FolderEntity::getName))
                .flatMap(folder -> toVisibleNodes(folder, childrenByParent, folderById, role, false).stream())
                .sorted(Comparator.comparing(FolderNodeResponse::name))
                .toList();
    }

    public FolderEntity getFolderOrThrow(Long id) {
        return folderRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Folder not found: " + id));
    }

    public FolderDetailResponse getFolderDetail(Long id, String rawRole) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        FolderEntity folder = getFolderOrThrow(id);
        if (!isFolderAccessible(folder, role)) {
            throw new IllegalArgumentException("Folder not found: " + id);
        }

        List<FolderEntity> folders = folderRepository.findAll();
        Map<Long, FolderEntity> folderById = folders.stream()
                .collect(Collectors.toMap(FolderEntity::getId, Function.identity()));
        Map<Long, List<FolderEntity>> childrenByParent = groupFoldersByParent(folders);

        List<FolderBreadcrumbResponse> breadcrumbs = buildBreadcrumbs(folder, folderById, role);
        List<FolderNodeResponse> children = childrenByParent.getOrDefault(folder.getId(), List.of()).stream()
                .sorted(Comparator.comparing(FolderEntity::getName))
                .flatMap(child -> toVisibleNodes(child, childrenByParent, folderById, role, isFolderVisibleByParent(folder, role)).stream())
                .toList();

        List<DocumentListItemResponse> documents = documentRepository
                .findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(folder.getId())
                .stream()
                .filter(document -> isDocumentAccessible(document, role))
                .map(this::toListItem)
                .toList();

        return new FolderDetailResponse(
                folder.getId(),
                folder.getName(),
                folder.getCode(),
                folder.getParentId(),
                breadcrumbs,
                countDocuments(folder, childrenByParent, role),
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
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        FolderEntity parent = getFolderOrThrow(parentId);
        if (!isFolderAccessible(parent, role)) {
            throw new IllegalArgumentException("Folder not found: " + parentId);
        }

        String trimmedName = name == null ? "" : name.trim();
        if (trimmedName.isBlank()) {
            throw new IllegalArgumentException("Folder name is required");
        }

        String code = "FLD-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
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
    public void deleteFolder(Long id, String rawRole) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        FolderEntity folder = getFolderOrThrow(id);
        if (!isFolderAccessible(folder, role)) {
            throw new IllegalArgumentException("Folder not found: " + id);
        }
        if (folder.getParentId() == null) {
            throw new IllegalArgumentException("System folders cannot be deleted");
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
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        FolderEntity folder = getFolderOrThrow(folderId);
        if (!isFolderAccessible(folder, role)) {
            throw new IllegalArgumentException("Folder not found: " + folderId);
        }

        List<DocumentEntity> documents;
        if (documentIds != null && !documentIds.isEmpty()) {
            documents = documentIds.stream()
                    .map(id -> documentRepository.findById(id)
                            .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id)))
                    .filter(document -> isDocumentAccessible(document, role))
                    .toList();
        } else {
            documents = documentRepository.findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(folderId).stream()
                    .filter(document -> isDocumentAccessible(document, role))
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
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        FolderEntity folder = getFolderOrThrow(id);
        if (!isFolderAccessible(folder, role)) {
            return false;
        }

        boolean hasSubfolders = folderRepository.findAll().stream()
                .anyMatch(candidate -> Objects.equals(candidate.getParentId(), id));
        if (hasSubfolders) {
            return true;
        }

        return !documentRepository.findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(id).stream()
                .filter(document -> isDocumentAccessible(document, role))
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
        if (role == null) {
            return true;
        }
        return isFolderAccessible(folder, role, new HashSet<>());
    }

    public boolean isDocumentAccessible(DocumentEntity document, UserRole role) {
        if (role == UserRole.ADMIN) {
            return true;
        }
        if (role == null) {
            return true;
        }
        if (document == null) {
            return false;
        }
        if (document.getFolderId() != null) {
            return folderRepository.findById(document.getFolderId())
                    .map(folder -> isFolderAccessible(folder, role))
                    .orElse(false);
        }

        return document.getCategory() != null && accessService.allowedUploadCategories(role).contains(document.getCategory());
    }

    private List<FolderNodeResponse> toVisibleNodes(
            FolderEntity folder,
            Map<Long, List<FolderEntity>> childrenByParent,
            Map<Long, FolderEntity> folderById,
            UserRole role,
            boolean parentVisible
    ) {
        boolean nodeVisible = role == null
                || parentVisible
                || accessService.matchesRoleFolderCode(folder.getCode(), role);

        List<FolderNodeResponse> children = childrenByParent.getOrDefault(folder.getId(), List.of()).stream()
                .sorted(Comparator.comparing(FolderEntity::getName))
                .flatMap(child -> toVisibleNodes(child, childrenByParent, folderById, role, nodeVisible).stream())
                .toList();

        if (!nodeVisible) {
            return children;
        }

        return List.of(new FolderNodeResponse(
                folder.getId(),
                folder.getName(),
                folder.getCode(),
                folder.getParentId(),
                countDocuments(folder, childrenByParent, role),
                children
        ));
    }

    private long countDocuments(FolderEntity folder, Map<Long, List<FolderEntity>> childrenByParent, UserRole role) {
        long total = documentRepository.findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(folder.getId()).stream()
                .filter(document -> isDocumentAccessible(document, role))
                .count();
        for (FolderEntity child : childrenByParent.getOrDefault(folder.getId(), List.of())) {
            total += countDocuments(child, childrenByParent, role);
        }
        return total;
    }

    private List<FolderBreadcrumbResponse> buildBreadcrumbs(
            FolderEntity folder,
            Map<Long, FolderEntity> folderById,
            UserRole role
    ) {
        ArrayDeque<FolderBreadcrumbResponse> breadcrumbs = new ArrayDeque<>();
        FolderEntity current = folder;
        Set<Long> visited = new HashSet<>();
        while (current != null && visited.add(current.getId())) {
            if (isFolderAccessible(current, role)) {
                breadcrumbs.push(new FolderBreadcrumbResponse(current.getId(), current.getName(), current.getCode()));
            }
            if (current.getParentId() == null) {
                break;
            }
            current = folderById.get(current.getParentId());
        }
        return new ArrayList<>(breadcrumbs);
    }

    private boolean isFolderAccessible(FolderEntity folder, UserRole role, Set<Long> visited) {
        if (role == UserRole.ADMIN) {
            return true;
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
                .map(parent -> isFolderAccessible(parent, role, visited))
                .orElse(false);
    }

    private boolean isFolderVisibleByParent(FolderEntity folder, UserRole role) {
        return isFolderAccessible(folder, role);
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
}
