package com.auca.archive.service;

import com.auca.archive.repository.DocumentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class StudentStorageService {
    private final DocumentRepository documentRepository;

    @Value("${archive.student.storage-limit-bytes:268435456}")
    private long storageLimitBytes;

    public StudentStorageService(DocumentRepository documentRepository) {
        this.documentRepository = documentRepository;
    }

    public long getStorageLimitBytes() {
        return storageLimitBytes;
    }

    public long getUsedBytes(String studentNumber) {
        if (studentNumber == null || studentNumber.isBlank()) {
            return 0L;
        }
        return documentRepository.findByStudentNumberIgnoreCaseOrderByIssueDateDesc(studentNumber.trim()).stream()
                .filter(document -> !document.isArchivedForRemoval())
                .mapToLong(document -> document.getSizeBytes() == null ? 0L : document.getSizeBytes())
                .sum();
    }

    public void requireQuota(String studentNumber, long additionalBytes) {
        if (studentNumber == null || studentNumber.isBlank()) {
            throw new IllegalArgumentException("Student ID is required for storage checks");
        }
        long used = getUsedBytes(studentNumber);
        long nextTotal = used + Math.max(additionalBytes, 0L);
        if (nextTotal > storageLimitBytes) {
            throw new IllegalArgumentException(
                    "Personal storage limit reached. You are using "
                            + formatBytes(used)
                            + " of "
                            + formatBytes(storageLimitBytes)
                            + ". Remove older files or upload a smaller document."
            );
        }
    }

    private String formatBytes(long bytes) {
        if (bytes < 1024) {
            return bytes + " B";
        }
        double value = bytes;
        String[] units = {"KB", "MB", "GB"};
        int index = -1;
        while (value >= 1024 && index < units.length - 1) {
            value /= 1024;
            index += 1;
        }
        return String.format("%.1f %s", value, units[index]);
    }
}
