package com.auca.archive.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class OcrSettingsService {
    private final boolean configuredEnabled;
    private final String tessDataPath;
    private volatile boolean runtimeEnabled;

    public OcrSettingsService(
            @Value("${archive.ocr.enabled:false}") boolean configuredEnabled,
            @Value("${archive.ocr.tessdata-path:}") String tessDataPath
    ) {
        this.configuredEnabled = configuredEnabled;
        this.tessDataPath = tessDataPath == null ? "" : tessDataPath.trim();
        this.runtimeEnabled = configuredEnabled;
    }

    public boolean isEnabled() {
        return runtimeEnabled;
    }

    public boolean isConfiguredEnabled() {
        return configuredEnabled;
    }

    public String tessDataPath() {
        return tessDataPath;
    }

    public void setEnabled(boolean enabled) {
        this.runtimeEnabled = enabled;
    }

    public boolean isAvailable(DocumentTextExtractionService textExtractionService) {
        return textExtractionService.isOcrAvailable();
    }
}
