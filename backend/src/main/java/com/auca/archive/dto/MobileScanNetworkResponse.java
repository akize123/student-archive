package com.auca.archive.dto;

public record MobileScanNetworkResponse(
        String host,
        int frontendPort,
        int apiPort,
        String scanBaseUrl,
        String apiBaseUrl
) {
}
