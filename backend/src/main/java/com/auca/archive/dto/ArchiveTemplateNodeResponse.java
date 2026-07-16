package com.auca.archive.dto;

import java.util.List;

public record ArchiveTemplateNodeResponse(
        Long id,
        String name,
        String code,
        List<ArchiveTemplateNodeResponse> children
) {
}
