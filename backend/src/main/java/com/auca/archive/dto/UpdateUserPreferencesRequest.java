package com.auca.archive.dto;

import java.util.Map;

public record UpdateUserPreferencesRequest(
        String folderColorMode,
        Map<String, String> folderColors,
        String uiDensity
) {
}
