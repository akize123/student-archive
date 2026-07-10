package com.auca.archive.domain;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public enum SystemPrivilege {
    USER_MANAGEMENT("Create and manage user accounts"),
    ROLE_MANAGEMENT("Change user roles"),
    PRIVILEGE_ASSIGNMENT("Assign user privileges"),
    ARCHIVE_ACCESS("Browse archive folders and documents"),
    DOCUMENT_UPLOAD("Upload documents to the archive"),
    DOCUMENT_APPROVAL("Review and approve submitted documents"),
    SYSTEM_MAINTENANCE("Monitor storage and system health");

    private final String description;

    SystemPrivilege(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }

    public static Set<SystemPrivilege> defaultsFor(UserRole role) {
        if (role == null) {
            return Set.of();
        }
        return switch (role) {
            case ADMIN -> EnumSet.allOf(SystemPrivilege.class);
            case REGISTRAR -> EnumSet.of(ARCHIVE_ACCESS, DOCUMENT_UPLOAD);
            case EXAMINATION_OFFICER -> EnumSet.of(ARCHIVE_ACCESS, DOCUMENT_UPLOAD);
            case HOD -> EnumSet.of(ARCHIVE_ACCESS, DOCUMENT_APPROVAL);
            case LIBRARIAN -> EnumSet.of(ARCHIVE_ACCESS, DOCUMENT_APPROVAL);
            case STUDENT -> EnumSet.of(ARCHIVE_ACCESS, DOCUMENT_UPLOAD);
        };
    }

    public static Set<SystemPrivilege> parseStored(String raw) {
        if (raw == null || raw.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(value -> SystemPrivilege.valueOf(value.toUpperCase(Locale.ROOT)))
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(SystemPrivilege.class)));
    }

    public static String serialize(Set<SystemPrivilege> privileges) {
        if (privileges == null || privileges.isEmpty()) {
            return "";
        }
        return privileges.stream()
                .map(Enum::name)
                .sorted()
                .collect(Collectors.joining(","));
    }

    public static List<Map<String, String>> catalog() {
        return Arrays.stream(values())
                .map(privilege -> {
                    Map<String, String> entry = new LinkedHashMap<>();
                    entry.put("code", privilege.name());
                    entry.put("label", humanize(privilege.name()));
                    entry.put("description", privilege.getDescription());
                    return entry;
                })
                .toList();
    }

    private static String humanize(String value) {
        return Arrays.stream(value.split("_"))
                .map(part -> part.charAt(0) + part.substring(1).toLowerCase(Locale.ROOT))
                .collect(Collectors.joining(" "));
    }
}
