package com.auca.archive.dto;

import java.util.List;

public record FolderImportResponse(
        int importedCount,
        int skippedCount,
        int folderCount,
        List<String> importedFiles,
        List<String> skippedFiles,
        List<String> messages
) {
}
