package com.auca.archive.dto;

public record RequestActor(
        Long accountId,
        String username,
        String displayName
) {
    public static RequestActor empty() {
        return new RequestActor(null, null, null);
    }

    public static RequestActor fromHeaders(String accountIdHeader, String usernameHeader, String displayNameHeader) {
        Long accountId = null;
        if (accountIdHeader != null && !accountIdHeader.isBlank()) {
            try {
                accountId = Long.parseLong(accountIdHeader.trim());
            } catch (NumberFormatException ignored) {
                accountId = null;
            }
        }
        String username = usernameHeader == null || usernameHeader.isBlank() ? null : usernameHeader.trim();
        String displayName = displayNameHeader == null || displayNameHeader.isBlank() ? null : displayNameHeader.trim();
        if (accountId == null && username == null && displayName == null) {
            return empty();
        }
        return new RequestActor(accountId, username, displayName);
    }

    public String resolvedActorLabel(String fallback) {
        if (displayName != null && !displayName.isBlank()) {
            return displayName;
        }
        if (username != null && !username.isBlank()) {
            return username;
        }
        return fallback == null || fallback.isBlank() ? "Archive user" : fallback;
    }
}
