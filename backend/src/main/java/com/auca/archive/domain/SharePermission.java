package com.auca.archive.domain;

public enum SharePermission {
    READ_ONLY("Read only"),
    WRITE("Write"),
    EDIT("Edit");

    private final String label;

    SharePermission(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public boolean allows(SharePermission required) {
        if (required == null) {
            return true;
        }
        return this.ordinal() >= required.ordinal();
    }

    public static SharePermission fromRaw(String raw) {
        if (raw == null || raw.isBlank()) {
            return READ_ONLY;
        }
        String normalized = raw.trim().toUpperCase(java.util.Locale.ROOT).replace('-', '_').replace(' ', '_');
        if ("READONLY".equals(normalized) || "READ".equals(normalized)) {
            return READ_ONLY;
        }
        return SharePermission.valueOf(normalized);
    }
}
