package com.auca.archive.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;

/**
 * Resolves document file paths across absolute, relative, and storage-root layouts.
 */
@Component
public class ArchiveStoragePaths {
    private final Path storageRoot;

    public ArchiveStoragePaths(@Value("${archive.storage-root:storage}") String storageRoot) {
        this.storageRoot = Path.of(storageRoot).toAbsolutePath().normalize();
    }

    public Path storageRoot() {
        return storageRoot;
    }

    /**
     * Prefer a portable path relative to the configured storage root.
     */
    public String toStoredPath(Path path) {
        if (path == null) {
            return null;
        }
        Path normalized = path.toAbsolutePath().normalize();
        if (normalized.startsWith(storageRoot)) {
            return storageRoot.relativize(normalized).toString().replace('\\', '/');
        }
        return normalized.toString();
    }

    public Path resolveExisting(String filePath) {
        if (filePath == null || filePath.isBlank()) {
            return null;
        }

        for (Path candidate : buildCandidates(filePath)) {
            if (candidate != null && Files.isRegularFile(candidate)) {
                return candidate;
            }
        }

        Path fileName = Path.of(filePath).getFileName();
        if (fileName == null || fileName.toString().isBlank() || !Files.isDirectory(storageRoot)) {
            return null;
        }

        try (Stream<Path> walk = Files.walk(storageRoot)) {
            return walk
                    .filter(Files::isRegularFile)
                    .filter(path -> fileName.toString().equalsIgnoreCase(path.getFileName().toString()))
                    .findFirst()
                    .orElse(null);
        } catch (IOException ignored) {
            return null;
        }
    }

    private List<Path> buildCandidates(String filePath) {
        List<Path> candidates = new ArrayList<>();
        Path raw = Path.of(filePath);
        candidates.add(raw);

        String normalized = filePath.replace('\\', '/');
        while (normalized.startsWith("./")) {
            normalized = normalized.substring(2);
        }

        if (!raw.isAbsolute()) {
            candidates.add(Path.of(System.getProperty("user.dir", ".")).resolve(raw).normalize());
            candidates.add(storageRoot.resolve(raw).normalize());
            candidates.add(storageRoot.resolve(normalized).normalize());
            if (normalized.toLowerCase(Locale.ROOT).startsWith("storage/")) {
                candidates.add(storageRoot.resolve(normalized.substring("storage/".length())).normalize());
            }
            return candidates;
        }

        int marker = normalized.toLowerCase(Locale.ROOT).lastIndexOf("/storage/");
        if (marker >= 0) {
            String relative = normalized.substring(marker + "/storage/".length());
            candidates.add(storageRoot.resolve(relative).normalize());
        }
        return candidates;
    }
}
