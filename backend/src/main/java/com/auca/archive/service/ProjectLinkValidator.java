package com.auca.archive.service;

import org.springframework.stereotype.Component;

import java.net.IDN;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Component
public class ProjectLinkValidator {
    private static final Set<String> BLOCKED_HOST_SUFFIXES = Set.of(
            ".local",
            ".internal",
            ".localhost"
    );

    public String normalizeGithubUrl(String raw) {
        String value = trimToNull(raw);
        if (value == null) {
            return null;
        }
        URI uri = parseHttpUrl(value, "GitHub URL");
        String host = normalizeHost(uri.getHost());
        if (!"github.com".equals(host) && !"www.github.com".equals(host)) {
            throw new IllegalArgumentException("GitHub URL must point to github.com");
        }
        if (uri.getPath() == null || uri.getPath().isBlank() || "/".equals(uri.getPath())) {
            throw new IllegalArgumentException("GitHub URL must include a repository path, e.g. https://github.com/user/repo");
        }
        return uri.toString();
    }

    public String normalizeExternalLinks(String raw) {
        String value = trimToNull(raw);
        if (value == null) {
            return null;
        }
        String[] parts = value.split("[\\n,]+");
        List<String> cleaned = new ArrayList<>();
        for (String part : parts) {
            String item = trimToNull(part);
            if (item == null) {
                continue;
            }
            URI uri = parseHttpUrl(item, "External link");
            cleaned.add(uri.toString());
        }
        if (cleaned.isEmpty()) {
            return null;
        }
        if (cleaned.size() > 8) {
            throw new IllegalArgumentException("You can add at most 8 external links");
        }
        return String.join("\n", cleaned);
    }

    private URI parseHttpUrl(String raw, String label) {
        String candidate = raw.trim();
        if (candidate.regionMatches(true, 0, "javascript:", 0, 11)
                || candidate.regionMatches(true, 0, "data:", 0, 5)
                || candidate.regionMatches(true, 0, "file:", 0, 5)
                || candidate.regionMatches(true, 0, "vbscript:", 0, 9)) {
            throw new IllegalArgumentException(label + " uses a blocked URL scheme");
        }
        URI uri;
        try {
            uri = URI.create(candidate);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException(label + " is not a valid URL");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!"https".equals(scheme) && !"http".equals(scheme)) {
            throw new IllegalArgumentException(label + " must start with https:// or http://");
        }
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new IllegalArgumentException(label + " must include a valid host name");
        }
        String host = normalizeHost(uri.getHost());
        if ("localhost".equals(host) || host.endsWith(".localhost") || isPrivateOrLocalHost(host)) {
            throw new IllegalArgumentException(label + " cannot point to a local or private network address");
        }
        for (String suffix : BLOCKED_HOST_SUFFIXES) {
            if (host.endsWith(suffix)) {
                throw new IllegalArgumentException(label + " cannot point to a local or private network address");
            }
        }
        if (uri.getUserInfo() != null && !uri.getUserInfo().isBlank()) {
            throw new IllegalArgumentException(label + " cannot include username or password in the URL");
        }
        return uri.normalize();
    }

    private boolean isPrivateOrLocalHost(String host) {
        if (host.matches("^\\d{1,3}(\\.\\d{1,3}){3}$")) {
            String[] parts = host.split("\\.");
            int a = Integer.parseInt(parts[0]);
            int b = Integer.parseInt(parts[1]);
            if (a == 10 || a == 127 || a == 0) {
                return true;
            }
            if (a == 192 && b == 168) {
                return true;
            }
            if (a == 172 && b >= 16 && b <= 31) {
                return true;
            }
            if (a == 169 && b == 254) {
                return true;
            }
        }
        return false;
    }

    private String normalizeHost(String host) {
        try {
            return IDN.toASCII(host.trim().toLowerCase(Locale.ROOT));
        } catch (Exception ex) {
            return host.trim().toLowerCase(Locale.ROOT);
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
