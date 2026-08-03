package com.auca.archive.dto;

import java.util.Map;

public record UserPreferencesResponse(
        String folderColorMode,
        Map<String, String> folderColors,
        String uiDensity
) {
}
