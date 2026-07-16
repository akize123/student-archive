package com.auca.archive.service;

import com.auca.archive.domain.ActivityCategory;
import com.auca.archive.domain.ApprovalStatus;
import com.auca.archive.domain.DocumentStatus;
import com.auca.archive.domain.DocumentType;
import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;
import com.auca.archive.model.ActivityEntryEntity;
import com.auca.archive.model.ApprovalTaskEntity;
import com.auca.archive.model.DocumentEntity;
import com.auca.archive.model.FolderEntity;
import com.auca.archive.repository.ActivityEntryRepository;
import com.auca.archive.repository.ApprovalTaskRepository;
import com.auca.archive.repository.DocumentRepository;
import com.auca.archive.repository.FolderRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Objects;

@Component
public class ArchiveSeedData implements CommandLineRunner {
    private final ArchiveStructureSeedService archiveStructureSeedService;
    private final FolderRepository folderRepository;
    private final DocumentRepository documentRepository;
    private final ApprovalTaskRepository approvalTaskRepository;
    private final ActivityEntryRepository activityEntryRepository;

    public ArchiveSeedData(
            ArchiveStructureSeedService archiveStructureSeedService,
            FolderRepository folderRepository,
            DocumentRepository documentRepository,
            ApprovalTaskRepository approvalTaskRepository,
            ActivityEntryRepository activityEntryRepository
    ) {
        this.archiveStructureSeedService = archiveStructureSeedService;
        this.folderRepository = folderRepository;
        this.documentRepository = documentRepository;
        this.approvalTaskRepository = approvalTaskRepository;
        this.activityEntryRepository = activityEntryRepository;
    }

    @Override
    public void run(String... args) {
        archiveStructureSeedService.seedArchiveStructure();

        boolean seedLegacyData = false;
        if (!seedLegacyData) {
            return;
        }

        FolderEntity registrar = ensureFolder("Registrar Office", "REG", null);
        FolderEntity transcripts = ensureFolder("Transcripts", "TRN", registrar.getId());
        FolderEntity enrollment = ensureFolder("Enrollment Records", "ENR", registrar.getId());
        FolderEntity exams = ensureFolder("Exam Registrations", "EXM", registrar.getId());
        FolderEntity graduation = ensureFolder("Graduation Files", "GRD", registrar.getId());

        DocumentEntity doc1 = documentRepository.save(buildDocument(
                "HOD-IT_SE_THESIS_2025_SEM1_Defense-Slides_v03_20250402.pptx",
                "Defense Slides",
                "M. Uwimana",
                "Software Engineering",
                "Kigali",
                "Registrar Office reviews for thesis defense",
                "thesis,defense,slides",
                registrar.getId(),
                24_400_000L,
                DocumentStatus.ARCHIVED,
                DocumentType.PPTX
        ));

        DocumentEntity doc2 = documentRepository.save(buildDocument(
                "HOD-IT_SE_THESIS_2025_SEM1_Meeting-Minutes_v02_20250422.docx",
                "Meeting Minutes",
                "K. Twagirayezu",
                "Software Engineering",
                "Registrar Office",
                "Minutes captured for the sem 1 defense coordination",
                "minutes,meeting,registrar",
                transcripts.getId(),
                1_200_000L,
                DocumentStatus.APPROVED,
                DocumentType.DOCX
        ));

        DocumentEntity doc3 = documentRepository.save(buildDocument(
                "HOD-IT_SE_THESIS_2025_SEM1_Thesis-Draft_v03_20251014.pdf",
                "Thesis Draft",
                "S. Ingabire",
                "Software Engineering",
                "Department Chair",
                "Thesis draft waiting for final review",
                "thesis,draft,review",
                graduation.getId(),
                5_800_000L,
                DocumentStatus.APPROVED,
                DocumentType.PDF
        ));

        documentRepository.save(buildDocument(
                "AUCA-2025_Enrollment_Checklist.pdf",
                "Enrollment Checklist",
                "A. Ntirenganya",
                "Admissions",
                "Admissions Desk",
                "Enrollment checklist for incoming students",
                "enrollment,checklist,admissions",
                enrollment.getId(),
                900_000L,
                DocumentStatus.PENDING,
                DocumentType.PDF
        ));

        documentRepository.save(buildDocument(
                "AUCA_Exam_Regulations_2026.pdf",
                "Exam Regulations",
                "Registrar Office",
                "Registrar Office",
                "Exams Committee",
                "Updated regulations for exam registration and compliance",
                "exams,regulations,policy",
                exams.getId(),
                2_800_000L,
                DocumentStatus.PENDING,
                DocumentType.PDF
        ));

        approvalTaskRepository.save(createApproval(doc1.getId(), doc1.getTitle(), "S. Ingabire", "High", "Needs approval before archiving"));
        approvalTaskRepository.save(createApproval(doc2.getId(), doc2.getTitle(), "K. Twagirayezu", "Medium", "Ready for registration office review"));
        approvalTaskRepository.save(createApproval(doc3.getId(), doc3.getTitle(), "M. Uwimana", "High", "Final sign-off pending"));
        approvalTaskRepository.save(createApproval(doc2.getId(), "Semester 1 minutes duplicate scan", "S. Ingabire", "Low", "Duplicate scan needs cleanup"));

        activityEntryRepository.save(activity(
                "Uploaded thesis defense slides",
                "M. Uwimana",
                ActivityCategory.UPLOAD,
                2,
                UserRole.HOD,
                null,
                "Software Engineering",
                StudentDocumentCategory.APPLICATION_DOCUMENTS,
                null
        ));
        activityEntryRepository.save(activity(
                "Approved meeting minutes",
                "T. Mukamana",
                ActivityCategory.APPROVAL,
                4,
                UserRole.HOD,
                null,
                "Software Engineering",
                StudentDocumentCategory.APPLICATION_DOCUMENTS,
                null
        ));
        activityEntryRepository.save(activity(
                "Synced registrar archive tree",
                "System",
                ActivityCategory.SYNC,
                6,
                UserRole.REGISTRAR,
                null,
                null,
                null,
                null
        ));
        activityEntryRepository.save(activity(
                "Archived thesis draft",
                "S. Ingabire",
                ActivityCategory.ARCHIVE,
                8,
                UserRole.HOD,
                null,
                "Software Engineering",
                StudentDocumentCategory.APPLICATION_DOCUMENTS,
                null
        ));
        activityEntryRepository.save(activity(
                "Shared exam registration regulations",
                "Registrar Office",
                ActivityCategory.SHARE,
                12,
                UserRole.REGISTRAR,
                UserRole.EXAMINATION_OFFICER,
                null,
                null,
                null
        ));
        activityEntryRepository.save(activity(
                "Uploaded registration form for STUD-2026-014",
                "Registrar Office",
                ActivityCategory.UPLOAD,
                3,
                UserRole.REGISTRAR,
                null,
                "Admissions",
                StudentDocumentCategory.REGISTRATION_FORM,
                "STUD-2026-014"
        ));
        activityEntryRepository.save(activity(
                "Processed reintegration request SRIN-2026-008",
                "K. Twagirayezu",
                ActivityCategory.APPROVAL,
                5,
                UserRole.REGISTRAR,
                null,
                "Admissions",
                StudentDocumentCategory.REINTEGRATION_FORM,
                null
        ));
        activityEntryRepository.save(activity(
                "Archived application documents for new intake",
                "Registrar Office",
                ActivityCategory.ARCHIVE,
                7,
                UserRole.REGISTRAR,
                null,
                "Admissions",
                StudentDocumentCategory.APPLICATION_DOCUMENTS,
                null
        ));
        activityEntryRepository.save(activity(
                "Uploaded final exam paper for IT301",
                "Examination Office",
                ActivityCategory.UPLOAD,
                1,
                UserRole.EXAMINATION_OFFICER,
                null,
                "Software Engineering",
                StudentDocumentCategory.EXAMINATION_DOCUMENTS,
                null
        ));
        activityEntryRepository.save(activity(
                "Published semester marks for School of IT",
                "Examination Office",
                ActivityCategory.SYNC,
                9,
                UserRole.EXAMINATION_OFFICER,
                null,
                "Software Engineering",
                null,
                null
        ));
        activityEntryRepository.save(activity(
                "Shared grading rubric with HOD",
                "Examination Office",
                ActivityCategory.SHARE,
                11,
                UserRole.EXAMINATION_OFFICER,
                UserRole.HOD,
                "Software Engineering",
                null,
                null
        ));
        activityEntryRepository.save(activity(
                "Approved thesis proposal for department review",
                "T. Mukamana",
                ActivityCategory.APPROVAL,
                10,
                UserRole.HOD,
                null,
                "Software Engineering",
                StudentDocumentCategory.APPLICATION_DOCUMENTS,
                null
        ));
        activityEntryRepository.save(activity(
                "Requested registrar verification for graduation list",
                "T. Mukamana",
                ActivityCategory.SYNC,
                14,
                UserRole.HOD,
                UserRole.REGISTRAR,
                "Software Engineering",
                null,
                null
        ));
        activityEntryRepository.save(activity(
                "Shared department minutes with registrar",
                "T. Mukamana",
                ActivityCategory.SHARE,
                16,
                UserRole.HOD,
                UserRole.REGISTRAR,
                "Software Engineering",
                null,
                null
        ));
    }

    private FolderEntity ensureFolder(String name, String code, Long parentId) {
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

    private DocumentEntity buildDocument(
            String fileName,
            String title,
            String owner,
            String department,
            String uploadedBy,
            String description,
            String tags,
            Long folderId,
            long sizeBytes,
            DocumentStatus status,
            DocumentType type
    ) {
        DocumentEntity entity = new DocumentEntity();
        entity.setTitle(title);
        entity.setFileName(fileName);
        entity.setDocumentCode("AUCA-" + Math.abs(fileName.hashCode()));
        entity.setOwnerName(owner);
        entity.setDepartment(department);
        entity.setUploadedBy(uploadedBy);
        entity.setDescription(description);
        entity.setTags(tags);
        entity.setFolderId(folderId);
        entity.setSizeBytes(sizeBytes);
        entity.setStarred(Boolean.FALSE);
        entity.setStatus(status);
        entity.setType(type);
        entity.setCreatedAt(LocalDateTime.now().minusDays(2));
        entity.setModifiedAt(LocalDateTime.now().minusDays(1));
        return entity;
    }

    private ApprovalTaskEntity createApproval(Long documentId, String title, String requestedBy, String priority, String note) {
        ApprovalTaskEntity entity = new ApprovalTaskEntity();
        entity.setDocumentId(documentId);
        entity.setDocumentTitle(title);
        entity.setRequestedBy(requestedBy);
        entity.setRequestedAt(LocalDateTime.now().minusHours(4));
        entity.setDueAt(LocalDateTime.now().plusDays(2));
        entity.setPriority(priority);
        entity.setNote(note);
        entity.setStatus(ApprovalStatus.PENDING);
        return entity;
    }

    private ActivityEntryEntity activity(
            String message,
            String actor,
            ActivityCategory category,
            int hoursAgo,
            UserRole sourceRole,
            UserRole targetRole,
            String academicDepartment,
            StudentDocumentCategory documentCategory,
            String studentNumber
    ) {
        ActivityEntryEntity entity = new ActivityEntryEntity();
        entity.setMessage(message);
        entity.setActor(actor);
        entity.setCategory(category);
        entity.setCreatedAt(LocalDateTime.now().minusHours(hoursAgo));
        entity.setSourceRole(sourceRole);
        entity.setTargetRole(targetRole);
        entity.setAcademicDepartment(academicDepartment);
        entity.setDocumentCategory(documentCategory);
        entity.setStudentNumber(studentNumber);
        return entity;
    }
}
