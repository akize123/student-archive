package com.auca.archive.service;

import com.auca.archive.config.AucaFacultyCatalog;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.model.DocumentEntity;
import com.auca.archive.repository.DocumentRepository;
import com.auca.archive.repository.DocumentTypeDefinitionRepository;
import com.auca.archive.search.ArchivedDocumentIndex;
import co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@ConditionalOnProperty(name = "archive.search.elasticsearch.enabled", havingValue = "true", matchIfMissing = true)
public class DocumentElasticsearchService {
    private static final Logger log = LoggerFactory.getLogger(DocumentElasticsearchService.class);

    private final ElasticsearchOperations elasticsearchOperations;
    private final DocumentRepository documentRepository;
    private final DocumentTypeDefinitionRepository documentTypeDefinitionRepository;
    private final FolderService folderService;
    private final boolean enabled;

    public DocumentElasticsearchService(
            ElasticsearchOperations elasticsearchOperations,
            DocumentRepository documentRepository,
            DocumentTypeDefinitionRepository documentTypeDefinitionRepository,
            FolderService folderService,
            @Value("${archive.search.elasticsearch.enabled:true}") boolean enabled
    ) {
        this.elasticsearchOperations = elasticsearchOperations;
        this.documentRepository = documentRepository;
        this.documentTypeDefinitionRepository = documentTypeDefinitionRepository;
        this.folderService = folderService;
        this.enabled = enabled;
    }

    public boolean isAvailable() {
        if (!enabled) {
            return false;
        }
        try {
            return elasticsearchOperations.indexOps(ArchivedDocumentIndex.class).exists();
        } catch (Exception ex) {
            log.warn("Elasticsearch is not available: {}", ex.getMessage());
            return false;
        }
    }

    public void ensureIndex() {
        if (!enabled) {
            return;
        }
        try {
            var indexOps = elasticsearchOperations.indexOps(ArchivedDocumentIndex.class);
            if (!indexOps.exists()) {
                indexOps.create();
                indexOps.putMapping(indexOps.createMapping());
            }
        } catch (Exception ex) {
            log.warn("Unable to ensure Elasticsearch index: {}", ex.getMessage());
        }
    }

    public void reindexAll() {
        if (!enabled) {
            return;
        }
        ensureIndex();
        try {
            documentRepository.findAll().forEach(this::indexDocument);
            log.info("Elasticsearch reindex completed for {} documents", documentRepository.count());
        } catch (Exception ex) {
            log.warn("Elasticsearch reindex failed: {}", ex.getMessage());
        }
    }

    public void indexDocument(DocumentEntity document) {
        if (!enabled || document == null || document.getId() == null) {
            return;
        }
        try {
            ensureIndex();
            elasticsearchOperations.save(toIndex(document));
        } catch (Exception ex) {
            log.warn("Unable to index document {}: {}", document.getId(), ex.getMessage());
        }
    }

    public void deleteDocument(Long documentId) {
        if (!enabled || documentId == null) {
            return;
        }
        try {
            elasticsearchOperations.delete(String.valueOf(documentId), ArchivedDocumentIndex.class);
        } catch (Exception ex) {
            log.warn("Unable to delete document {} from Elasticsearch: {}", documentId, ex.getMessage());
        }
    }

    public Optional<List<Long>> searchDocumentIds(String query, StudentDocumentCategory category) {
        if (!enabled || query == null || query.isBlank()) {
            return Optional.of(List.of());
        }
        try {
            ensureIndex();
            String trimmed = query.trim();
            Query textQuery = Query.of(builder -> builder.multiMatch(match -> match
                    .query(trimmed)
                    .fields(
                            "title^3",
                            "studentNumber^4",
                            "ownerName^2",
                            "fileName^2",
                            "department",
                            "faculty",
                            "description",
                            "tags",
                            "documentCode",
                            "examType",
                            "academicYear",
                            "semester",
                            "course",
                            "examRoom",
                            "uploadedBy",
                            "searchableText"
                    )
            ));

            BoolQuery.Builder bool = new BoolQuery.Builder()
                    .must(textQuery)
                    .filter(filter -> filter.term(term -> term.field("archived").value(false)));

            if (category != null) {
                bool.filter(filter -> filter.term(term -> term.field("category").value(category.name())));
            }

            NativeQuery nativeQuery = NativeQuery.builder()
                    .withQuery(Query.of(q -> q.bool(bool.build())))
                    .withPageable(PageRequest.of(0, 100))
                    .build();

            SearchHits<ArchivedDocumentIndex> hits = elasticsearchOperations.search(nativeQuery, ArchivedDocumentIndex.class);
            return Optional.of(hits.getSearchHits().stream()
                    .map(SearchHit::getContent)
                    .map(ArchivedDocumentIndex::getId)
                    .toList());
        } catch (Exception ex) {
            log.warn("Elasticsearch search failed, falling back to database search: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    private ArchivedDocumentIndex toIndex(DocumentEntity document) {
        ArchivedDocumentIndex index = new ArchivedDocumentIndex();
        index.setId(document.getId());
        index.setTitle(document.getTitle());
        index.setFileName(document.getFileName());
        index.setOwnerName(document.getOwnerName());
        index.setStudentNumber(document.getStudentNumber());
        index.setDepartment(document.getDepartment());
        index.setFaculty(resolveFaculty(document.getDepartment()));
        index.setDescription(document.getDescription());
        index.setTags(document.getTags());
        index.setCategory(document.getCategory() == null ? null : document.getCategory().name());
        index.setDocumentCode(document.getDocumentCode());
        index.setExamType(document.getExamType());
        index.setAcademicYear(document.getAcademicYear());
        index.setSemester(document.getSemester());
        index.setDocumentTypeName(resolveDocumentTypeName(document));
        index.setFolderPath(resolveFolderPath(document.getFolderId()));
        index.setCourse(document.getCourse());
        index.setExamRoom(document.getExamRoom());
        index.setUploadedBy(document.getUploadedBy());
        index.setArchived(document.isArchivedForRemoval());
        index.setIssueDate(document.getIssueDate());
        index.setModifiedAt(document.getModifiedAt());
        index.setSearchableText(buildSearchableText(document));
        return index;
    }

    private String buildSearchableText(DocumentEntity document) {
        List<String> parts = new ArrayList<>();
        addPart(parts, document.getTitle());
        addPart(parts, document.getFileName());
        addPart(parts, document.getOwnerName());
        addPart(parts, document.getStudentNumber());
        addPart(parts, document.getDepartment());
        addPart(parts, resolveFaculty(document.getDepartment()));
        addPart(parts, document.getDescription());
        addPart(parts, document.getTags());
        addPart(parts, document.getDocumentCode());
        addPart(parts, document.getExamType());
        addPart(parts, document.getAcademicYear());
        addPart(parts, document.getSemester());
        addPart(parts, resolveDocumentTypeName(document));
        addPart(parts, resolveFolderPath(document.getFolderId()));
        addPart(parts, document.getCourse());
        addPart(parts, document.getExamRoom());
        addPart(parts, document.getUploadedBy());
        if (document.getCategory() != null) {
            addPart(parts, document.getCategory().name());
            addPart(parts, document.getCategory().getDisplayName());
        }
        return parts.stream()
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.joining(" "));
    }

    private String resolveDocumentTypeName(DocumentEntity document) {
        if (document.getDocumentTypeId() == null) {
            return document.getCategory() == null ? null : document.getCategory().getDisplayName();
        }
        return documentTypeDefinitionRepository.findById(document.getDocumentTypeId())
                .map(type -> type.getName())
                .orElse(null);
    }

    private String resolveFolderPath(Long folderId) {
        if (folderId == null) {
            return null;
        }
        try {
            return folderService.buildBreadcrumbPath(folderId);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String resolveFaculty(String department) {
        if (department == null || department.isBlank()) {
            return null;
        }
        for (AucaFacultyCatalog.FacultyEntry faculty : AucaFacultyCatalog.FACULTIES) {
            boolean matches = faculty.departments().stream()
                    .anyMatch(item -> item.trim().equalsIgnoreCase(department.trim()));
            if (matches) {
                return faculty.name();
            }
        }
        return null;
    }

    private void addPart(List<String> parts, String value) {
        if (value != null && !value.isBlank()) {
            parts.add(value.trim());
        }
    }
}
