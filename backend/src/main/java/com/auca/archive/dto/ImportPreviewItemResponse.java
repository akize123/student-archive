package com.auca.archive.dto;

import java.util.List;

public record ImportPreviewItemResponse(
        String originalPath,
        String suggestedFolderName,
        String suggestedStudentNumber,
        String suggestedStudentName,
        String resolutionSource,
        String proposedTitle,
        List<String> warnings,
        List<String> conflicts,
        Integer validationSimilarityScore,
        Boolean validationVerified,
        String scanSummary,
        List<String> scanSignals,
        String scanPreview,
        Boolean studentExists,
        String existingStudentName,
        Long existingFolderId,
        Boolean folderExistsHere
) {
}
