package com.auca.archive.dto;

import java.util.List;

public record MobileScanReorderRequest(
        List<String> pageIds
) {
}
