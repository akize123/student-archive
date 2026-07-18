package com.auca.archive.service;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.domain.DocumentType;
import com.auca.archive.domain.SharePermission;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.ActivityScope;
import com.auca.archive.dto.DocumentShareAccessContext;
import com.auca.archive.dto.DocumentListItemResponse;
import com.auca.archive.dto.FolderBreadcrumbResponse;
import com.auca.archive.dto.FolderDetailResponse;
import com.auca.archive.dto.FolderNodeResponse;
import com.auca.archive.dto.RequestActor;
import com.auca.archive.dto.ShareFolderResponse;
import com.auca.archive.dto.SharedItemResponse;
import com.auca.archive.model.DocumentEntity;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.model.FolderShareEntity;
import com.auca.archive.repository.DocumentRepository;
import com.auca.archive.repository.FolderRepository;
import com.auca.archive.repository.FolderShareRepository;
import com.auca.archive.repository.StudentRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
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
    private final StudentRepository studentRepository;
    private final FolderShareRepository folderShareRepository;
    private final ArchiveAccessService accessService;
    private final ActivityService activityService;
    private final FileEncryptionService fileEncryptionService;
    private final StudentIdFormatService studentIdFormatService;
    private final AcademicTermService academicTermService;
    private final ObjectProvider<ArchiveTreeService> archiveTreeService;
    private final Path storageRoot;

    public FolderService(
            FolderRepository folderRepository,
            DocumentRepository documentRepository,
            StudentRepository studentRepository,
            FolderShareRepository folderShareRepository,
            ArchiveAccessService accessService,
            ActivityService activityService,
            FileEncryptionService fileEncryptionService,
            StudentIdFormatService studentIdFormatService,
            AcademicTermService academicTermService,
            ObjectProvider<ArchiveTreeService> archiveTreeService,
            @Value("${archive.storage-root:storage}") String storageRoot
    ) {
        this.folderRepository = folderRepository;
        this.documentRepository = documentRepository;
        this.studentRepository = studentRepository;
        this.folderShareRepository = folderShareRepository;
        this.accessService = accessService;
        this.activityService = activityService;
        this.fileEncryptionService = fileEncryptionService;
        this.studentIdFormatService = studentIdFormatService;
        this.academicTermService = academicTermService;
        this.archiveTreeService = archiveTreeService;
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

        if (role == UserRole.LIBRARIAN) {
            archiveTreeService.getObject().ensureLibrarianReviewFolders();
        }

        List<FolderEntity> folders = folderRepository.findAll();
        Map<Long, FolderEntity> folderById = folders.stream()
                .collect(Collectors.toMap(FolderEntity::getId, Function.identity()));
        Map<Long, List<FolderEntity>> childrenByParent = groupFoldersByParent(folders);

        List<FolderNodeResponse> tree = childrenByParent.getOrDefault(null, List.of()).stream()
                .sorted(Comparator.comparing(FolderEntity::getName))
                .flatMap(folder -> toVisibleNodes(folder, childrenByParent, folderById, role, null, false).stream())
                .sorted(Comparator.comparing(FolderNodeResponse::name))
                .toList();

        if (role == UserRole.LIBRARIAN) {
            return prioritizeLibrarianReviewFolders(tree);
        }
        return tree;
    }

    private List<FolderNodeResponse> prioritizeLibrarianReviewFolders(List<FolderNodeResponse> tree) {
        List<FolderNodeResponse> prioritized = new ArrayList<>();
        List<FolderNodeResponse> rest = new ArrayList<>();
        for (FolderNodeResponse node : tree) {
            if (ArchiveTreeService.LIBRARY_REVIEW_CODE.equalsIgnoreCase(String.valueOf(node.code()))) {
                prioritized.add(node);
            } else {
                rest.add(node);
            }
        }
        prioritized.addAll(rest);
        return prioritized;
    }

    public FolderEntity getFolderOrThrow(Long id) {
        return folderRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Folder not found: " + id));
    }

    public String resolveAcademicDepartmentFromFolderId(Long folderId) {
        if (folderId == null) {
            return null;
        }
        FolderEntity current = folderRepository.findById(folderId).orElse(null);
        while (current != null) {
            if (isDepartmentFolder(current)) {
                return current.getName();
            }
            Long parentId = current.getParentId();
            current = parentId == null ? null : folderRepository.findById(parentId).orElse(null);
        }
        return null;
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
        List<FolderNodeResponse> children;
        List<DocumentListItemResponse> documents;

        if (role == UserRole.LIBRARIAN && ArchiveTreeService.LIBRARY_REJECTED_CODE.equalsIgnoreCase(folder.getCode())) {
            children = childrenByParent.getOrDefault(folder.getId(), List.of()).stream()
                    .sorted(Comparator.comparing(FolderEntity::getName))
                    .map(child -> toNode(child, role, studentNumber))
                    .toList();
            documents = collectDocumentsUnderFolder(folder.getId(), childrenByParent).stream()
                    .filter(document -> !document.isArchivedForRemoval())
                    .filter(document -> isDocumentAccessible(document, role, studentNumber))
                    .sorted(Comparator.comparing(DocumentEntity::getModifiedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                    .map(this::toListItem)
                    .toList();
        } else {
            List<FolderEntity> rawChildren = childrenByParent.getOrDefault(folder.getId(), List.of());
            boolean flattenStudentRoot = role != null
                    && role != UserRole.STUDENT
                    && ArchiveTreeService.isSemesterStudentRootFolder(folder.getCode());

            children = rawChildren.stream()
                    .filter(child -> role != UserRole.STUDENT || isVisibleStudentChild(child))
                    .filter(child -> !flattenStudentRoot || !ArchiveTreeService.isStudentDefaultFolderCode(child.getCode()))
                    .sorted(Comparator.comparing(FolderEntity::getName))
                    .flatMap(child -> toVisibleNodes(child, childrenByParent, folderById, role, studentNumber, isFolderVisibleByParent(folder, role, studentNumber)).stream())
                    .toList();

            List<DocumentEntity> folderDocuments;
            if (flattenStudentRoot) {
                folderDocuments = new ArrayList<>(
                        documentRepository.findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(folder.getId())
                );
                for (FolderEntity child : rawChildren) {
                    if (ArchiveTreeService.isStudentDefaultFolderCode(child.getCode())) {
                        folderDocuments.addAll(
                                documentRepository.findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(child.getId())
                        );
                    }
                }
            } else if (isArchiveProjectFolder(folder)) {
                folderDocuments = collectDocumentsUnderFolder(folder.getId(), childrenByParent);
            } else {
                folderDocuments = resolveFolderDocuments(folder, childrenByParent);
            }

            documents = folderDocuments.stream()
                    .filter(document -> isDocumentAccessible(document, role, studentNumber))
                    .sorted(Comparator.comparing(DocumentEntity::getModifiedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                    .map(this::toListItem)
                    .toList();
        }

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

    private List<DocumentEntity> resolveFolderDocuments(FolderEntity folder, Map<Long, List<FolderEntity>> childrenByParent) {
        Long linkedDocumentId = ArchiveTreeService.parseLinkedDocumentIdFromFolderCode(folder.getCode());
        if (linkedDocumentId != null && isDocumentMirrorFolder(folder)) {
            return documentRepository.findById(linkedDocumentId)
                    .filter(document -> !document.isArchivedForRemoval())
                    .stream()
                    .toList();
        }
        return documentRepository.findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(folder.getId());
    }

    private boolean isDocumentMirrorFolder(FolderEntity folder) {
        if (folder == null || folder.getCode() == null) {
            return false;
        }
        String code = folder.getCode().toUpperCase(Locale.ROOT);
        return code.contains("-STU-")
                && (ArchiveTreeService.isLibrarianAcceptedFolderCode(code)
                || ArchiveTreeService.isPublishedArchiveFolderCode(code));
    }

    public Optional<FolderNodeResponse> getStudentPublishedArchiveTree(String rawStudentNumber) {
        UserRole role = UserRole.STUDENT;
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        ArchiveTreeService.StudentWorkspace workspace = ensureStudentWorkspace(studentNumber);
        FolderEntity semesterFolder = folderRepository.findById(workspace.studentRoot().getParentId())
                .orElseThrow(() -> new IllegalArgumentException("Semester folder not found for student workspace"));
        FolderEntity acceptedRoot = archiveTreeService.getObject().ensureSemesterPublishedArchive(semesterFolder);
        List<FolderEntity> folders = folderRepository.findAll();
        Map<Long, List<FolderEntity>> childrenByParent = groupFoldersByParent(folders);
        return Optional.of(buildPublishedArchiveNode(acceptedRoot, childrenByParent, studentNumber));
    }

    public Optional<Long> getStudentPublishedArchiveRootId(String rawStudentNumber) {
        return getStudentPublishedArchiveTree(rawStudentNumber).map(FolderNodeResponse::id);
    }

    private FolderNodeResponse buildPublishedArchiveNode(
            FolderEntity folder,
            Map<Long, List<FolderEntity>> childrenByParent,
            String studentNumber
    ) {
        List<FolderNodeResponse> children = childrenByParent.getOrDefault(folder.getId(), List.of()).stream()
                .sorted(Comparator.comparing(FolderEntity::getName))
                .map(child -> buildPublishedArchiveNode(child, childrenByParent, studentNumber))
                .toList();
        long documentCount = resolveFolderDocuments(folder, childrenByParent).stream()
                .filter(document -> isDocumentAccessible(document, UserRole.STUDENT, studentNumber))
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
                false,
                children
        );
    }

    public boolean isPublishedPeerDocument(DocumentEntity document, String studentNumber) {
        if (document == null
                || studentNumber == null
                || studentNumber.isBlank()
                || document.getCategory() != StudentDocumentCategory.FINAL_YEAR_PROJECT
                || document.getStatus() != DocumentStatus.APPROVED
                || accessService.isStudentDocument(document, studentNumber)) {
            return false;
        }
        Optional<Long> studentSemesterId = resolveStudentSemesterId(studentNumber);
        if (studentSemesterId.isEmpty()) {
            return false;
        }
        String semesterPrefix = folderRepository.findById(studentSemesterId.get())
                .map(FolderEntity::getCode)
                .orElse("");
        if (semesterPrefix.isBlank()) {
            return false;
        }
        Long documentId = document.getId();
        return folderRepository.findAll().stream()
                .anyMatch(folder -> folder.getCode() != null
                        && folder.getCode().startsWith(semesterPrefix)
                        && ArchiveTreeService.isPublishedArchiveFolderCode(folder.getCode())
                        && documentId.equals(ArchiveTreeService.parseLinkedDocumentIdFromFolderCode(folder.getCode())));
    }

    private List<DocumentEntity> collectDocumentsUnderFolder(Long folderId, Map<Long, List<FolderEntity>> childrenByParent) {
        List<DocumentEntity> documents = new ArrayList<>(
                documentRepository.findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(folderId)
        );
        for (FolderEntity child : childrenByParent.getOrDefault(folderId, List.of())) {
            documents.addAll(collectDocumentsUnderFolder(child.getId(), childrenByParent));
        }
        return documents;
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
            throw new IllegalArgumentException("You can only create folders inside Official Documents or Final Year Project");
        }
        if (role == UserRole.STUDENT && isArchiveProjectFolder(parent)) {
            throw new IllegalArgumentException("Archive project is managed automatically when a project is accepted");
        }
        if (role != UserRole.STUDENT) {
            requireStaffCreateTarget(parent, role);
        }
        requireShareAtLeast(parent, role, studentNumber, SharePermission.WRITE);

        String trimmedName = name == null ? "" : name.trim();
        if (trimmedName.isBlank()) {
            throw new IllegalArgumentException("Folder name is required");
        }
        if (role != UserRole.STUDENT) {
            // Staff archive folders must follow year + semester + department + student sequence.
            studentIdFormatService.requireStaffFolderName(trimmedName);
            trimmedName = trimmedName.toUpperCase(Locale.ROOT);
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
                ArchiveTreeService.isStudentDefaultFolderCode(folder.getCode()),
                List.of()
        );
    }

    @Transactional
    public FolderNodeResponse addAcademicYear(Long departmentFolderId, String rawAcademicYear, String rawRole) {
        return addAcademicYear(departmentFolderId, rawAcademicYear, rawRole, RequestActor.empty());
    }

    @Transactional
    public FolderNodeResponse addAcademicYear(
            Long departmentFolderId,
            String rawAcademicYear,
            String rawRole,
            RequestActor requestActor
    ) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        if (role != UserRole.REGISTRAR && role != UserRole.LIBRARIAN && role != UserRole.EXAMINATION_OFFICER) {
            throw new IllegalArgumentException("Only the registrar office, examination office, or librarian can add academic years");
        }

        FolderEntity department = getFolderOrThrow(departmentFolderId);
        if (!isFolderAccessible(department, role, null)) {
            throw new IllegalArgumentException("Folder not found: " + departmentFolderId);
        }
        if (!isDepartmentFolder(department)) {
            throw new IllegalArgumentException("Academic years can only be added under a department folder");
        }
        requireShareAtLeast(department, role, null, SharePermission.WRITE);

        String academicYear = academicTermService.normalizeAcademicYear(rawAcademicYear);
        if (academicYear == null) {
            throw new IllegalArgumentException("Academic year must use the format 2025-2026");
        }

        String academicYearCode = academicTermService.buildAcademicYearFolderCode(department.getCode(), academicYear);
        if (folderRepository.findByCode(academicYearCode).isPresent()) {
            throw new IllegalArgumentException("Academic year " + academicYear + " already exists in this department");
        }

        FolderEntity academicYearFolder = folderRepository.save(
                new FolderEntity(academicYear, academicYearCode, department.getId())
        );

        int startYear = academicTermService.parseStartYear(academicYear);
        for (int semester = 1; semester <= AcademicTermService.SEMESTERS_PER_YEAR; semester++) {
            String semesterName = academicTermService.formatSemesterFolderName(startYear, semester);
            String semesterCode = academicTermService.buildSemesterFolderCode(
                    academicYearCode,
                    startYear,
                    semester
            );
            folderRepository.save(new FolderEntity(semesterName, semesterCode, academicYearFolder.getId()));
        }

        activityService.recordAction(
                "Added academic year \"" + academicYear + "\" to " + department.getName(),
                requestActor.resolvedActorLabel(role.name()),
                ActivityCategory.SYNC,
                activityService.enrichScope(ActivityScope.builder()
                        .sourceRole(role)
                        .academicDepartment(department.getName())
                        .build(), requestActor),
                requestActor
        );

        return toNode(academicYearFolder, role, null);
    }

    @Transactional
    public FolderNodeResponse renameFolder(Long id, String name, String rawRole, String rawStudentNumber) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        FolderEntity folder = getFolderOrThrow(id);
        requireModifiableFolder(folder, role, studentNumber);
        requireShareAtLeast(folder, role, studentNumber, SharePermission.EDIT);

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
        requireShareAtLeast(folder, role, studentNumber, SharePermission.EDIT);

        FolderEntity targetParent = getFolderOrThrow(targetParentId);
        requirePasteTarget(targetParent, role, studentNumber);
        requireShareAtLeast(targetParent, role, studentNumber, SharePermission.WRITE);
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
        requireShareAtLeast(targetParent, role, studentNumber, SharePermission.WRITE);
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
        requireShareAtLeast(folder, role, null, SharePermission.EDIT);
        if (folder.getParentId() == null) {
            throw new IllegalArgumentException("System folders cannot be deleted");
        }
        if (isProtectedArchiveStructureFolder(folder)) {
            throw new IllegalArgumentException("Faculty and department folders are part of the system archive structure and cannot be deleted");
        }
        if (ArchiveTreeService.isStudentDefaultFolderCode(folder.getCode())
                || ArchiveTreeService.isLibrarianReviewFolderCode(folder.getCode())) {
            throw new IllegalArgumentException("System review folders cannot be deleted");
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
        return downloadAsZip(folderId, documentIds, null, rawRole, null);
    }

    public byte[] downloadAsZip(
            Long folderId,
            List<Long> documentIds,
            List<Long> folderIds,
            String rawRole,
            String rawStudentNumber
    ) throws IOException {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        FolderEntity folder = getFolderOrThrow(folderId);
        if (!isFolderAccessible(folder, role, studentNumber)) {
            throw new IllegalArgumentException("Folder not found: " + folderId);
        }

        Map<Long, FolderEntity> folderById = folderRepository.findAll().stream()
                .collect(Collectors.toMap(FolderEntity::getId, Function.identity()));
        Map<Long, List<FolderEntity>> childrenByParent = groupFoldersByParent(folderById.values().stream().toList());

        List<ZipDocumentEntry> entries = new ArrayList<>();
        boolean hasSelection = (documentIds != null && !documentIds.isEmpty())
                || (folderIds != null && !folderIds.isEmpty());

        if (hasSelection) {
            if (documentIds != null) {
                for (Long documentId : documentIds) {
                    documentRepository.findById(documentId)
                            .filter(document -> !document.isArchivedForRemoval())
                            .filter(document -> isDocumentAccessible(document, role, studentNumber))
                            .filter(document -> isDocumentDownloadAllowed(document, role, studentNumber))
                            .ifPresent(document -> entries.add(new ZipDocumentEntry(
                                    sanitizeZipPath(document.getFileName() == null ? "document-" + document.getId() : document.getFileName()),
                                    document
                            )));
                }
            }
            if (folderIds != null) {
                for (Long selectedFolderId : folderIds) {
                    FolderEntity selected = folderById.get(selectedFolderId);
                    if (selected == null || !isFolderAccessible(selected, role, studentNumber)) {
                        continue;
                    }
                    if (!Objects.equals(selectedFolderId, folderId) && !isDescendantOf(folderId, selectedFolderId)) {
                        continue;
                    }
                    collectDocumentsRecursive(selected, selected.getName(), childrenByParent, role, studentNumber, entries);
                }
            }
        } else {
            collectDocumentsRecursive(folder, "", childrenByParent, role, studentNumber, entries);
        }

        if (entries.isEmpty()) {
            throw new IllegalArgumentException("No documents to download in this folder");
        }

        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        Set<String> usedNames = new HashSet<>();
        try (ZipOutputStream zip = new ZipOutputStream(buffer)) {
            for (ZipDocumentEntry entry : entries) {
                DocumentEntity document = entry.document();
                if (document.getFilePath() == null || document.getFilePath().isBlank()) {
                    continue;
                }
                Path path = Path.of(document.getFilePath());
                if (!Files.exists(path)) {
                    continue;
                }
                byte[] storedBytes = Files.readAllBytes(path);
                byte[] plainBytes = fileEncryptionService.decrypt(storedBytes, document.getEncryptionIv());
                String entryName = uniqueZipEntryName(usedNames, entry.relativePath());
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

    private void collectDocumentsRecursive(
            FolderEntity folder,
            String relativePrefix,
            Map<Long, List<FolderEntity>> childrenByParent,
            UserRole role,
            String studentNumber,
            List<ZipDocumentEntry> entries
    ) {
        String prefix = relativePrefix == null ? "" : relativePrefix.trim();
        for (DocumentEntity document : documentRepository.findByFolderIdAndArchivedAtIsNullOrderByModifiedAtDesc(folder.getId())) {
            if (!isDocumentAccessible(document, role, studentNumber)) {
                continue;
            }
            if (!isDocumentDownloadAllowed(document, role, studentNumber)) {
                continue;
            }
            String fileName = document.getFileName() == null || document.getFileName().isBlank()
                    ? "document-" + document.getId() + ".pdf"
                    : document.getFileName();
            String path = prefix.isBlank() ? sanitizeZipPath(fileName) : prefix + "/" + sanitizeZipPath(fileName);
            entries.add(new ZipDocumentEntry(path, document));
        }
        for (FolderEntity child : childrenByParent.getOrDefault(folder.getId(), List.of())) {
            if (!isFolderAccessible(child, role, studentNumber)) {
                continue;
            }
            String childPrefix = prefix.isBlank()
                    ? sanitizeZipPath(child.getName())
                    : prefix + "/" + sanitizeZipPath(child.getName());
            collectDocumentsRecursive(child, childPrefix, childrenByParent, role, studentNumber, entries);
        }
    }

    private String sanitizeZipPath(String value) {
        String sanitized = String.valueOf(value == null ? "item" : value).replaceAll("[\\\\:*?\"<>|]", "_").trim();
        return sanitized.isBlank() ? "item" : sanitized.replaceAll("^/+", "").replaceAll("/+", "/");
    }

    private record ZipDocumentEntry(String relativePath, DocumentEntity document) {
    }

    public ShareFolderResponse shareFolder(Long folderId, String targetRoleRaw, String permissionRaw, String actorRoleRaw, String actorName) {
        return shareItems(List.of(folderId), List.of(), targetRoleRaw, permissionRaw, null, null, null, actorRoleRaw, actorName, RequestActor.empty());
    }

    public ShareFolderResponse shareFolder(
            Long folderId,
            String targetRoleRaw,
            String permissionRaw,
            String expirationPreset,
            String expiresAtRaw,
            Boolean allowReshare,
            String actorRoleRaw,
            String actorName,
            RequestActor requestActor
    ) {
        return shareItems(
                List.of(folderId),
                List.of(),
                targetRoleRaw,
                permissionRaw,
                expirationPreset,
                expiresAtRaw,
                allowReshare,
                actorRoleRaw,
                actorName,
                requestActor
        );
    }

    public ShareFolderResponse shareFolder(
            Long folderId,
            String targetRoleRaw,
            String permissionRaw,
            String actorRoleRaw,
            String actorName,
            RequestActor requestActor
    ) {
        return shareItems(List.of(folderId), List.of(), targetRoleRaw, permissionRaw, null, null, null, actorRoleRaw, actorName, requestActor);
    }

    @Transactional
    public ShareFolderResponse shareItems(
            List<Long> folderIds,
            List<Long> documentIds,
            String targetRoleRaw,
            String permissionRaw,
            String actorRoleRaw,
            String actorName
    ) {
        return shareItems(folderIds, documentIds, targetRoleRaw, permissionRaw, null, null, null, actorRoleRaw, actorName, RequestActor.empty());
    }

    @Transactional
    public ShareFolderResponse shareItems(
            List<Long> folderIds,
            List<Long> documentIds,
            String targetRoleRaw,
            String permissionRaw,
            String actorRoleRaw,
            String actorName,
            RequestActor requestActor
    ) {
        return shareItems(folderIds, documentIds, targetRoleRaw, permissionRaw, null, null, null, actorRoleRaw, actorName, requestActor);
    }

    @Transactional
    public ShareFolderResponse shareItems(
            List<Long> folderIds,
            List<Long> documentIds,
            String targetRoleRaw,
            String permissionRaw,
            String expirationPreset,
            String expiresAtRaw,
            Boolean allowReshareRaw,
            String actorRoleRaw,
            String actorName,
            RequestActor requestActor
    ) {
        UserRole actorRole = accessService.resolveRole(actorRoleRaw);
        if (actorRole == UserRole.STUDENT) {
            throw new IllegalArgumentException("Students cannot share archive items");
        }
        UserRole targetRole = accessService.resolveRole(targetRoleRaw);
        validateShareTarget(actorRole, targetRole);
        SharePermission permission = SharePermission.fromRaw(permissionRaw);
        LocalDateTime expiresAt = resolveShareExpiresAt(expirationPreset, expiresAtRaw);
        boolean allowReshare = Boolean.TRUE.equals(allowReshareRaw);

        LinkedHashSet<Long> uniqueFolderIds = new LinkedHashSet<>();
        if (folderIds != null) {
            folderIds.stream().filter(Objects::nonNull).forEach(uniqueFolderIds::add);
        }
        LinkedHashSet<Long> uniqueDocumentIds = new LinkedHashSet<>();
        if (documentIds != null) {
            documentIds.stream().filter(Objects::nonNull).forEach(uniqueDocumentIds::add);
        }
        if (uniqueFolderIds.isEmpty() && uniqueDocumentIds.isEmpty()) {
            throw new IllegalArgumentException("Select at least one folder or file to share");
        }

        String actor = actorName == null || actorName.isBlank() ? actorRole.name() : actorName.trim();
        int sharedFolders = 0;
        int sharedDocuments = 0;
        String firstName = null;

        for (Long folderId : uniqueFolderIds) {
            FolderEntity folder = getFolderOrThrow(folderId);
            if (!isFolderAccessible(folder, actorRole)) {
                throw new IllegalArgumentException("Folder not found: " + folderId);
            }
            requireCanShareFolder(folder, actorRole, null);
            saveFolderShare(folder, targetRole, permission, actor, expiresAt, allowReshare);
            sharedFolders++;
            if (firstName == null) {
                firstName = folder.getName();
            }
        }

        for (Long documentId : uniqueDocumentIds) {
            DocumentEntity document = documentRepository.findById(documentId)
                    .filter(item -> !item.isArchivedForRemoval())
                    .orElseThrow(() -> new IllegalArgumentException("Document not found: " + documentId));
            if (!isDocumentAccessible(document, actorRole)) {
                throw new IllegalArgumentException("Document not found: " + documentId);
            }
            requireCanShareDocument(document, actorRole, null);
            saveDocumentShare(document, targetRole, permission, actor, expiresAt, allowReshare);
            sharedDocuments++;
            if (firstName == null) {
                firstName = document.getTitle() == null || document.getTitle().isBlank()
                        ? document.getFileName()
                        : document.getTitle();
            }
        }

        String targetLabel = roleLabel(targetRole);
        String academicDepartment = null;
        if (!uniqueFolderIds.isEmpty()) {
            academicDepartment = resolveAcademicDepartmentFromFolderId(uniqueFolderIds.iterator().next());
        } else if (!uniqueDocumentIds.isEmpty()) {
            DocumentEntity firstDocument = documentRepository.findById(uniqueDocumentIds.iterator().next()).orElse(null);
            if (firstDocument != null) {
                academicDepartment = firstDocument.getDepartment() != null && !firstDocument.getDepartment().isBlank()
                        ? firstDocument.getDepartment()
                        : resolveAcademicDepartmentFromFolderId(firstDocument.getFolderId());
            }
        }
        activityService.recordShare(
                firstName == null ? "archive items" : firstName,
                actor,
                actorRole,
                targetRole,
                academicDepartment,
                requestActor
        );

        StringBuilder message = new StringBuilder("Shared ");
        if (sharedFolders > 0) {
            message.append(sharedFolders).append(sharedFolders == 1 ? " folder" : " folders");
        }
        if (sharedFolders > 0 && sharedDocuments > 0) {
            message.append(" and ");
        }
        if (sharedDocuments > 0) {
            message.append(sharedDocuments).append(sharedDocuments == 1 ? " file" : " files");
        }
        message.append(" with ").append(targetLabel)
                .append(" (").append(permission.getLabel()).append(").");
        if (expiresAt != null) {
            message.append(" Access expires ").append(expiresAt.toLocalDate()).append(".");
        }
        if (permission == SharePermission.VIEW_ONLY) {
            message.append(" Download is restricted for recipients.");
        }
        if (allowReshare) {
            message.append(" Recipients may re-share these items.");
        }
        message.append(" Recipients can open it under Shared with me.");

        Long openFolderId = uniqueFolderIds.isEmpty() ? null : uniqueFolderIds.iterator().next();
        String shareUrl = openFolderId != null ? "#/folders/" + openFolderId : "#/shared";
        return new ShareFolderResponse(message.toString(), shareUrl, targetRole.name(), targetLabel);
    }

    public List<SharedItemResponse> listSharedWithMe(String rawRole, String rawStudentNumber) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        if (role == null) {
            return List.of();
        }
        return folderShareRepository.findByTargetRoleOrderByCreatedAtDesc(role).stream()
                .filter(this::isShareActive)
                .map(this::toSharedItem)
                .filter(Objects::nonNull)
                .toList();
    }

    public long countSharedWithMe(String rawRole, String rawStudentNumber) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        String studentNumber = normalizeStudentNumber(rawStudentNumber);
        accessService.requireStudentAccount(role, studentNumber);
        if (role == null) {
            return 0;
        }
        return folderShareRepository.findByTargetRoleOrderByCreatedAtDesc(role).stream()
                .filter(this::isShareActive)
                .count();
    }

    public void requireDocumentShareAtLeast(DocumentEntity document, UserRole role, SharePermission minimum) {
        if (document == null || role == null || role == UserRole.ADMIN) {
            return;
        }
        Optional<FolderShareEntity> documentShare = findActiveDocumentShare(document.getId(), role);
        if (documentShare.isPresent()) {
            if (!documentShare.get().getPermission().allows(minimum)) {
                throw new IllegalArgumentException("This share is "
                        + documentShare.get().getPermission().getLabel()
                        + ". You need " + minimum.getLabel() + " permission.");
            }
            return;
        }
        if (document.getFolderId() == null) {
            return;
        }
        folderRepository.findById(document.getFolderId()).ifPresent(folder ->
                requireShareAtLeast(folder, role, null, minimum));
    }

    public void requireDocumentDownloadAllowed(DocumentEntity document, UserRole role, String studentNumber) {
        if (document == null || role == null || role == UserRole.ADMIN) {
            return;
        }
        if (hasNativeDocumentAccess(document, role, studentNumber)) {
            return;
        }
        SharePermission effective = resolveEffectiveSharePermission(document, role)
                .orElse(null);
        if (effective == SharePermission.VIEW_ONLY) {
            throw new IllegalArgumentException(
                    "Download is restricted for this shared document. View-only access applies.");
        }
    }

    public boolean isDocumentDownloadAllowed(DocumentEntity document, UserRole role, String studentNumber) {
        if (document == null || role == null || role == UserRole.ADMIN) {
            return true;
        }
        if (hasNativeDocumentAccess(document, role, studentNumber)) {
            return true;
        }
        return resolveEffectiveSharePermission(document, role)
                .map(permission -> permission != SharePermission.VIEW_ONLY)
                .orElse(true);
    }

    public Optional<LocalDateTime> resolveDocumentShareExpiresAt(DocumentEntity document, UserRole role) {
        return resolveDocumentShareExpiresAt(document, role, null);
    }

    public DocumentShareAccessContext resolveDocumentShareAccess(
            DocumentEntity document,
            UserRole role,
            String studentNumber
    ) {
        if (document == null || role == null || role == UserRole.ADMIN) {
            return DocumentShareAccessContext.fullAccess();
        }
        if (hasNativeDocumentAccess(document, role, studentNumber)) {
            return DocumentShareAccessContext.fullAccess();
        }
        Optional<SharePermission> permission = resolveEffectiveSharePermission(document, role);
        if (permission.isEmpty()) {
            return DocumentShareAccessContext.fullAccess();
        }
        SharePermission effective = permission.get();
        LocalDateTime expiresAt = findActiveDocumentShare(document.getId(), role)
                .map(FolderShareEntity::getExpiresAt)
                .or(() -> document.getFolderId() == null
                        ? Optional.empty()
                        : folderRepository.findById(document.getFolderId())
                                .flatMap(folder -> findActiveFolderShare(folder, role))
                                .map(FolderShareEntity::getExpiresAt))
                .orElse(null);
        return new DocumentShareAccessContext(
                true,
                effective != SharePermission.VIEW_ONLY,
                effective,
                effective.getLabel(),
                expiresAt
        );
    }

    public Optional<LocalDateTime> resolveDocumentShareExpiresAt(DocumentEntity document, UserRole role, String studentNumber) {
        LocalDateTime expiresAt = resolveDocumentShareAccess(document, role, studentNumber).shareExpiresAt();
        return expiresAt == null ? Optional.empty() : Optional.of(expiresAt);
    }

    private void saveFolderShare(
            FolderEntity folder,
            UserRole targetRole,
            SharePermission permission,
            String actor,
            LocalDateTime expiresAt,
            boolean allowReshare
    ) {
        FolderShareEntity share = folderShareRepository
                .findByFolderIdAndTargetRoleAndDocumentIdIsNull(folder.getId(), targetRole)
                .orElseGet(FolderShareEntity::new);
        share.setFolderId(folder.getId());
        share.setDocumentId(null);
        FolderEntity facultyFolder = findFacultyAncestor(folder);
        share.setFacultyFolderId(facultyFolder == null ? null : facultyFolder.getId());
        share.setTargetRole(targetRole);
        share.setPermission(permission);
        share.setSharedBy(actor);
        share.setCreatedAt(LocalDateTime.now());
        share.setExpiresAt(expiresAt);
        share.setAllowReshare(allowReshare);
        folderShareRepository.save(share);
    }

    private void saveDocumentShare(
            DocumentEntity document,
            UserRole targetRole,
            SharePermission permission,
            String actor,
            LocalDateTime expiresAt,
            boolean allowReshare
    ) {
        FolderShareEntity share = folderShareRepository
                .findByDocumentIdAndTargetRole(document.getId(), targetRole)
                .orElseGet(FolderShareEntity::new);
        share.setDocumentId(document.getId());
        share.setFolderId(document.getFolderId());
        share.setFacultyFolderId(null);
        share.setTargetRole(targetRole);
        share.setPermission(permission);
        share.setSharedBy(actor);
        share.setCreatedAt(LocalDateTime.now());
        share.setExpiresAt(expiresAt);
        share.setAllowReshare(allowReshare);
        folderShareRepository.save(share);
    }

    private SharedItemResponse toSharedItem(FolderShareEntity share) {
        if (share == null) {
            return null;
        }
        SharePermission permission = share.getPermission();
        if (share.getDocumentId() != null) {
            DocumentEntity document = documentRepository.findById(share.getDocumentId())
                    .filter(item -> !item.isArchivedForRemoval())
                    .orElse(null);
            if (document == null) {
                return null;
            }
            String name = document.getTitle() == null || document.getTitle().isBlank()
                    ? document.getFileName()
                    : document.getTitle();
            return new SharedItemResponse(
                    share.getId(),
                    "DOCUMENT",
                    document.getFolderId(),
                    document.getId(),
                    name,
                    permission.name(),
                    permission.getLabel(),
                    share.getSharedBy(),
                    share.getTargetRole() == null ? null : share.getTargetRole().name(),
                    share.getCreatedAt(),
                    document.getFolderId() == null ? "#/shared" : "#/folders/" + document.getFolderId(),
                    share.getExpiresAt(),
                    permission != SharePermission.VIEW_ONLY,
                    share.isAllowReshare()
            );
        }
        if (share.getFolderId() == null) {
            return null;
        }
        FolderEntity folder = folderRepository.findById(share.getFolderId()).orElse(null);
        if (folder == null) {
            return null;
        }
        return new SharedItemResponse(
                share.getId(),
                "FOLDER",
                folder.getId(),
                null,
                folder.getName(),
                permission.name(),
                permission.getLabel(),
                share.getSharedBy(),
                share.getTargetRole() == null ? null : share.getTargetRole().name(),
                share.getCreatedAt(),
                "#/folders/" + folder.getId(),
                share.getExpiresAt(),
                permission != SharePermission.VIEW_ONLY,
                share.isAllowReshare()
        );
    }

    private FolderEntity findFacultyAncestor(FolderEntity folder) {
        FolderEntity current = folder;
        Set<Long> visited = new HashSet<>();
        while (current != null && visited.add(current.getId())) {
            if (isFacultyFolder(current)) {
                return current;
            }
            if (current.getParentId() == null) {
                return null;
            }
            current = folderRepository.findById(current.getParentId()).orElse(null);
        }
        return null;
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
        if (target == UserRole.ADMIN) {
            throw new IllegalArgumentException("Choose Examination Office, Head of Department, Librarian, or Student");
        }
        List<UserRole> allowedTargets = List.of(
                UserRole.EXAMINATION_OFFICER,
                UserRole.HOD,
                UserRole.LIBRARIAN,
                UserRole.STUDENT
        );
        if (!allowedTargets.contains(target)) {
            throw new IllegalArgumentException("Choose Examination Office, Head of Department, Librarian, or Student");
        }
        if (source == UserRole.STUDENT) {
            throw new IllegalArgumentException("Students cannot share archive items");
        }
        if (source == target) {
            throw new IllegalArgumentException("Choose a different party to share with");
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
        if (document == null) {
            return false;
        }
        if (role == null) {
            return true;
        }
        if (role == UserRole.ADMIN) {
            return true;
        }
        if (role != null && findActiveDocumentShare(document.getId(), role).isPresent()) {
            return true;
        }
        if (role == UserRole.STUDENT) {
            if (accessService.isStudentDocument(document, studentNumber)) {
                return true;
            }
            if (isPublishedPeerDocument(document, studentNumber)) {
                return true;
            }
            if (document.getFolderId() == null) {
                return false;
            }
            return folderRepository.findById(document.getFolderId())
                    .map(folder -> isSharedWithRole(folder, UserRole.STUDENT))
                    .orElse(false);
        }

        if (document.getCategory() == StudentDocumentCategory.FINAL_YEAR_PROJECT
                && document.getStatus() != DocumentStatus.APPROVED) {
            if (role != UserRole.LIBRARIAN || !accessService.canViewOfficeDocument(document, role)) {
                return false;
            }
        } else if (!accessService.canViewOfficeDocument(document, role)) {
            return false;
        }

        if (document.getFolderId() != null) {
            return folderRepository.findById(document.getFolderId())
                    .map(folder -> isFolderAccessible(folder, role, studentNumber))
                    .orElse(false);
        }

        return document.getCategory() != null && accessService.allowedUploadCategories(role).contains(document.getCategory());
    }

    private List<FolderNodeResponse> getStudentPersonalTree(String studentNumber) {
        ArchiveTreeService.StudentWorkspace workspace = ensureStudentWorkspace(studentNumber);
        List<FolderEntity> folders = folderRepository.findAll();
        Map<Long, List<FolderEntity>> childrenByParent = groupFoldersByParent(folders);
        return List.of(
                buildStudentNode(workspace.officialDocuments(), childrenByParent, studentNumber),
                buildStudentNode(workspace.myProjects(), childrenByParent, studentNumber),
                buildStudentNode(workspace.archiveProject(), childrenByParent, studentNumber)
        );
    }

    private ArchiveTreeService.StudentWorkspace ensureStudentWorkspace(String studentNumber) {
        return studentRepository.findByStudentNumber(studentNumber.trim().toUpperCase(Locale.ROOT))
                .or(() -> studentRepository.findByStudentNumber(studentNumber.trim()))
                .map(student -> archiveTreeService.getObject().ensureStudentWorkspace(student))
                .orElseThrow(() -> new IllegalArgumentException("Student profile not found for workspace setup"));
    }

    private FolderNodeResponse buildStudentNode(
            FolderEntity folder,
            Map<Long, List<FolderEntity>> childrenByParent,
            String studentNumber
    ) {
        List<FolderNodeResponse> children = childrenByParent.getOrDefault(folder.getId(), List.of()).stream()
                .filter(this::isVisibleStudentChild)
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
                ArchiveTreeService.isStudentDefaultFolderCode(folder.getCode()),
                children
        );
    }

    private boolean isVisibleStudentChild(FolderEntity child) {
        if (child == null || child.getCode() == null) {
            return false;
        }
        String code = child.getCode().toUpperCase(Locale.ROOT);
        // Hide legacy category folders and librarian-only rejected locations from students.
        return !(code.endsWith("-SREG") || code.endsWith("-SRIN") || code.endsWith("-SAPP")
                || code.endsWith("-SEXM") || code.endsWith("-SFYP")
                || ArchiveTreeService.isLibrarianRejectedFolderCode(code)
                || ArchiveTreeService.isLibrarianReviewFolderCode(code));
    }

    private List<FolderNodeResponse> toVisibleNodes(
            FolderEntity folder,
            Map<Long, List<FolderEntity>> childrenByParent,
            Map<Long, FolderEntity> folderById,
            UserRole role,
            String studentNumber,
            boolean parentVisible
    ) {
        // Never expose Library FYP Reviews (or its children) to non-librarian staff,
        // even when the AUCA root parent is visible.
        if (role != null
                && role != UserRole.ADMIN
                && role != UserRole.LIBRARIAN
                && ArchiveTreeService.isLibrarianReviewFolderCode(folder.getCode())) {
            return List.of();
        }
        // Mirrored "Shared Documents" copies must not appear in the archive tree —
        // shares are listed only under Quick Access → Shared with me.
        if (isMirroredSharedDocumentsFolder(folder)) {
            return List.of();
        }

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

        long itemCount = countDocuments(folder, childrenByParent, role, studentNumber);
        if (accessService.isOfficeStaffRole(role)
                && ArchiveTreeService.isSemesterStudentRootFolder(folder.getCode())
                && itemCount == 0) {
            return List.of();
        }

        return List.of(new FolderNodeResponse(
                folder.getId(),
                folder.getName(),
                folder.getCode(),
                folder.getParentId(),
                itemCount,
                ArchiveTreeService.isStudentDefaultFolderCode(folder.getCode())
                        || isProtectedArchiveStructureFolder(folder)
                        || folder.getParentId() == null,
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
        if (folder == null) {
            return false;
        }
        if (!visited.add(folder.getId())) {
            return false;
        }
        if (role == UserRole.STUDENT) {
            if (ArchiveTreeService.isLibrarianReviewFolderCode(folder.getCode())
                    || ArchiveTreeService.isLibrarianRejectedFolderCode(folder.getCode())) {
                return false;
            }
            if (accessService.isStudentFolder(folder, studentNumber)) {
                return true;
            }
            if (isStudentPublishedArchiveFolder(folder, studentNumber)) {
                return true;
            }
            return isSharedWithRole(folder, UserRole.STUDENT);
        }
        // Library FYP Reviews is librarian-only; do not inherit visibility from AUCA root.
        if (role != UserRole.LIBRARIAN && ArchiveTreeService.isLibrarianReviewFolderCode(folder.getCode())) {
            return false;
        }
        if (isSharedWithRole(folder, role)) {
            return true;
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

    public void requireShareAtLeast(FolderEntity folder, UserRole role, String studentNumber, SharePermission minimum) {
        if (folder == null || role == null || role == UserRole.ADMIN || minimum == null) {
            return;
        }
        if (hasNativeAccessIgnoringShares(folder, role, studentNumber)) {
            return;
        }
        SharePermission granted = findEffectiveSharePermission(folder, role)
                .orElseThrow(() -> new IllegalArgumentException("Folder not found: " + folder.getId()));
        if (!granted.allows(minimum)) {
            throw new IllegalArgumentException("This share is "
                    + granted.getLabel()
                    + ". You need " + minimum.getLabel() + " permission.");
        }
    }

    private Optional<SharePermission> findEffectiveSharePermission(FolderEntity folder, UserRole role) {
        return findActiveFolderShare(folder, role).map(FolderShareEntity::getPermission);
    }

    private boolean hasNativeAccessIgnoringShares(FolderEntity folder, UserRole role, String studentNumber) {
        if (role == UserRole.ADMIN || role == UserRole.LIBRARIAN) {
            return true;
        }
        if (role == UserRole.STUDENT) {
            return accessService.isStudentFolder(folder, studentNumber);
        }
        FolderEntity current = folder;
        Set<Long> visited = new HashSet<>();
        while (current != null && visited.add(current.getId())) {
            if (accessService.matchesRoleFolderCode(current.getCode(), role)) {
                return true;
            }
            if (current.getParentId() == null) {
                break;
            }
            current = folderRepository.findById(current.getParentId()).orElse(null);
        }
        return false;
    }

    private boolean isSharedWithRole(FolderEntity folder, UserRole role) {
        if (folder == null || role == null) {
            return false;
        }
        // Mirrored Shared Documents folders are hidden from the tree; do not treat them as live shares.
        if (isMirroredSharedDocumentsFolder(folder)) {
            return false;
        }
        if (findActiveFolderShare(folder, role).isPresent()) {
            return true;
        }
        FolderEntity current = folder;
        Set<Long> visited = new HashSet<>();
        while (current != null && visited.add(current.getId())) {
            if (isMirroredSharedDocumentsFolder(current)) {
                return false;
            }
            if (findActiveFolderShare(current, role).isPresent()) {
                return true;
            }
            if (current.getParentId() == null) {
                break;
            }
            current = folderRepository.findById(current.getParentId()).orElse(null);
        }
        return false;
    }

    private boolean isMirroredSharedDocumentsFolder(FolderEntity folder) {
        if (folder == null) {
            return false;
        }
        String code = folder.getCode() == null ? "" : folder.getCode().toUpperCase(Locale.ROOT);
        if (code.contains("-SHARED") || code.endsWith("SHARED") || code.equals("SHARED")) {
            return true;
        }
        String name = folder.getName() == null ? "" : folder.getName().trim().toLowerCase(Locale.ROOT);
        return "shared documents".equals(name);
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
        if (isArchiveProjectFolder(parent) || isUnderArchiveProject(parent)) {
            return false;
        }
        String code = parent.getCode() == null ? "" : parent.getCode().toUpperCase(Locale.ROOT);
        return code.endsWith("-" + ArchiveTreeService.OFFICIAL_DOCUMENTS_SUFFIX)
                || code.endsWith("-" + ArchiveTreeService.FINAL_YEAR_PROJECT_SUFFIX);
    }

    private boolean isStudentPublishedArchiveFolder(FolderEntity folder, String studentNumber) {
        if (folder == null || studentNumber == null || !ArchiveTreeService.isPublishedArchiveFolderCode(folder.getCode())) {
            return false;
        }
        Optional<Long> studentSemesterId = resolveStudentSemesterId(studentNumber);
        return studentSemesterId.isPresent() && isUnderFolderTree(folder, studentSemesterId.get());
    }

    private Optional<Long> resolveStudentSemesterId(String studentNumber) {
        try {
            ArchiveTreeService.StudentWorkspace workspace = ensureStudentWorkspace(studentNumber);
            return Optional.ofNullable(workspace.studentRoot().getParentId());
        } catch (RuntimeException ex) {
            return Optional.empty();
        }
    }

    private boolean isUnderFolderTree(FolderEntity folder, Long ancestorId) {
        FolderEntity current = folder;
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

    private boolean isArchiveProjectFolder(FolderEntity folder) {
        return folder != null && folder.getCode() != null
                && folder.getCode().toUpperCase(Locale.ROOT).endsWith("-" + ArchiveTreeService.ARCHIVE_PROJECT_SUFFIX);
    }

    private boolean isUnderArchiveProject(FolderEntity folder) {
        FolderEntity current = folder;
        Set<Long> visited = new HashSet<>();
        while (current != null && visited.add(current.getId())) {
            if (isArchiveProjectFolder(current)) {
                return true;
            }
            if (current.getParentId() == null) {
                return false;
            }
            current = folderRepository.findById(current.getParentId()).orElse(null);
        }
        return false;
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
        if (isOfficeArchiveRole(role) && !isSemesterOrDeeperFolder(parent)) {
            throw new IllegalArgumentException("Open a semester folder first. New folders can be created from semester level downward");
        }
    }

    private boolean isAdminStaff(UserRole role) {
        return role == UserRole.ADMIN;
    }

    private boolean isOfficeArchiveRole(UserRole role) {
        return role == UserRole.REGISTRAR
                || role == UserRole.EXAMINATION_OFFICER
                || role == UserRole.HOD;
    }

    private boolean isSemesterOrDeeperFolder(FolderEntity folder) {
        if (folder == null || folder.getCode() == null) {
            return false;
        }
        return folder.getCode().toUpperCase(Locale.ROOT).contains("-SEM-");
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
            throw new IllegalArgumentException("Official Documents and Final Year Project cannot be changed. You can only rename or move your own subfolders.");
        }
    }

    private void requirePasteTarget(FolderEntity targetParent, UserRole role, String studentNumber) {
        if (!isFolderAccessible(targetParent, role, studentNumber)) {
            throw new IllegalArgumentException("Destination folder not found: " + targetParent.getId());
        }
        if (role == UserRole.STUDENT && !canStudentCreateSubfolder(targetParent, studentNumber)) {
            throw new IllegalArgumentException("You can only paste folders inside Official Documents or Final Year Project");
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
        if (ArchiveTreeService.isStudentDefaultFolderCode(code)) {
            return false;
        }
        return ArchiveTreeService.isWithinStudentDefaultWorkspace(code) && code.contains("-MY-");
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
                ArchiveTreeService.isStudentDefaultFolderCode(folder.getCode())
                        || isProtectedArchiveStructureFolder(folder)
                        || folder.getParentId() == null,
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
        copy.setDocumentCode((source.getDocumentCode() == null ? "DOC" : source.getDocumentCode())
                + "-COPY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT));
        copy.setOwnerName(source.getOwnerName());
        copy.setStudentNumber(source.getStudentNumber());
        copy.setDepartment(source.getDepartment());
        copy.setUploadedBy(source.getUploadedBy());
        copy.setUploadedByRole(source.getUploadedByRole());
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
                document.getReviewNote(),
                document.getDescription(),
                document.getCoverPhotoPath() != null && !document.getCoverPhotoPath().isBlank()
        );
    }

    private boolean isShareActive(FolderShareEntity share) {
        if (share == null) {
            return false;
        }
        LocalDateTime expiresAt = share.getExpiresAt();
        return expiresAt == null || expiresAt.isAfter(LocalDateTime.now());
    }

    private LocalDateTime resolveShareExpiresAt(String expirationPreset, String expiresAtRaw) {
        if (expirationPreset == null || expirationPreset.isBlank()
                || "NEVER".equalsIgnoreCase(expirationPreset.trim())) {
            return null;
        }
        String preset = expirationPreset.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        LocalDateTime now = LocalDateTime.now();
        if ("7_DAYS".equals(preset) || "7DAYS".equals(preset)) {
            return now.plusDays(7);
        }
        if ("30_DAYS".equals(preset) || "30DAYS".equals(preset)) {
            return now.plusDays(30);
        }
        if ("CUSTOM".equals(preset) && expiresAtRaw != null && !expiresAtRaw.isBlank()) {
            String raw = expiresAtRaw.trim();
            try {
                return LocalDateTime.parse(raw);
            } catch (RuntimeException ignored) {
                return LocalDate.parse(raw).atTime(23, 59, 59);
            }
        }
        return null;
    }

    private Optional<FolderShareEntity> findActiveDocumentShare(Long documentId, UserRole role) {
        if (documentId == null || role == null) {
            return Optional.empty();
        }
        return folderShareRepository.findByDocumentIdAndTargetRole(documentId, role)
                .filter(this::isShareActive);
    }

    private Optional<FolderShareEntity> findActiveFolderShare(FolderEntity folder, UserRole role) {
        if (folder == null || role == null) {
            return Optional.empty();
        }
        FolderEntity current = folder;
        Set<Long> visited = new HashSet<>();
        while (current != null && visited.add(current.getId())) {
            Optional<FolderShareEntity> share = folderShareRepository
                    .findByFolderIdAndTargetRoleAndDocumentIdIsNull(current.getId(), role)
                    .filter(this::isShareActive);
            if (share.isPresent()) {
                return share;
            }
            if (current.getParentId() == null) {
                break;
            }
            current = folderRepository.findById(current.getParentId()).orElse(null);
        }
        return Optional.empty();
    }

    private Optional<SharePermission> resolveEffectiveSharePermission(DocumentEntity document, UserRole role) {
        Optional<FolderShareEntity> documentShare = findActiveDocumentShare(document.getId(), role);
        if (documentShare.isPresent()) {
            return Optional.of(documentShare.get().getPermission());
        }
        if (document.getFolderId() == null) {
            return Optional.empty();
        }
        return folderRepository.findById(document.getFolderId())
                .flatMap(folder -> findActiveFolderShare(folder, role))
                .map(FolderShareEntity::getPermission);
    }

    private boolean hasNativeDocumentAccess(DocumentEntity document, UserRole role, String studentNumber) {
        if (document == null || role == null) {
            return false;
        }
        if (role == UserRole.ADMIN) {
            return true;
        }
        if (role == UserRole.STUDENT) {
            if (accessService.isStudentDocument(document, studentNumber)) {
                return true;
            }
            if (isPublishedPeerDocument(document, studentNumber)) {
                return true;
            }
            if (document.getFolderId() == null) {
                return false;
            }
            return folderRepository.findById(document.getFolderId())
                    .map(folder -> accessService.isStudentFolder(folder, studentNumber))
                    .orElse(false);
        }

        if (document.getCategory() == StudentDocumentCategory.FINAL_YEAR_PROJECT
                && document.getStatus() != DocumentStatus.APPROVED) {
            if (role != UserRole.LIBRARIAN || !accessService.canViewOfficeDocument(document, role)) {
                return false;
            }
        } else if (!accessService.canViewOfficeDocument(document, role)) {
            return false;
        }

        if (document.getFolderId() != null) {
            return folderRepository.findById(document.getFolderId())
                    .map(folder -> hasNativeAccessIgnoringShares(folder, role, studentNumber))
                    .orElse(false);
        }

        return document.getCategory() != null && accessService.allowedUploadCategories(role).contains(document.getCategory());
    }

    private void requireCanShareFolder(FolderEntity folder, UserRole role, String studentNumber) {
        if (role == UserRole.ADMIN || hasNativeAccessIgnoringShares(folder, role, studentNumber)) {
            return;
        }
        Optional<FolderShareEntity> share = findActiveFolderShare(folder, role);
        if (share.isPresent() && share.get().isAllowReshare()) {
            return;
        }
        throw new IllegalArgumentException(
                "You cannot share this folder. Only the original owner or users with re-share permission can share it.");
    }

    private void requireCanShareDocument(DocumentEntity document, UserRole role, String studentNumber) {
        if (role == UserRole.ADMIN || hasNativeDocumentAccess(document, role, studentNumber)) {
            return;
        }
        Optional<FolderShareEntity> documentShare = findActiveDocumentShare(document.getId(), role);
        if (documentShare.isPresent() && documentShare.get().isAllowReshare()) {
            return;
        }
        if (document.getFolderId() != null) {
            Optional<FolderShareEntity> folderShare = folderRepository.findById(document.getFolderId())
                    .flatMap(folder -> findActiveFolderShare(folder, role));
            if (folderShare.isPresent() && folderShare.get().isAllowReshare()) {
                return;
            }
        }
        throw new IllegalArgumentException(
                "You cannot share this document. Only the original owner or users with re-share permission can share it.");
    }
}
