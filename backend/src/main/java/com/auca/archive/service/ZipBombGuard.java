package com.auca.archive.service;

import com.auca.archive.util.FileSignatureValidator;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

final class ZipBombGuard {
    static final long MAX_ARCHIVE_BYTES = 50L * 1024L * 1024L;
    /** Hard stop for zip-bomb style archives with excessive records. */
    static final int MAX_ZIP_RECORDS = 100000;
    /** PDF files extracted for import. */
    static final int MAX_PDF_ENTRIES = 10000;
    static final long MAX_UNCOMPRESSED_BYTES = 200L * 1024L * 1024L;
    static final long MAX_SINGLE_ENTRY_BYTES = 20L * 1024L * 1024L;
    static final int MAX_COMPRESSION_RATIO = 150;

    record ExtractedEntry(String relativePath, byte[] bytes) {
    }

    private ZipBombGuard() {
    }

    static List<ExtractedEntry> extractSafe(byte[] archiveBytes) throws IOException {
        if (archiveBytes == null || archiveBytes.length == 0) {
            throw new IllegalArgumentException("ZIP archive is empty.");
        }
        if (archiveBytes.length > MAX_ARCHIVE_BYTES) {
            throw new IllegalArgumentException("ZIP archive is too large. Maximum size is 50 MB.");
        }

        List<ExtractedEntry> entries = new ArrayList<>();
        long totalUncompressed = 0;
        int zipRecords = 0;
        int pdfEntries = 0;

        try (ZipInputStream zipInputStream = new ZipInputStream(new java.io.ByteArrayInputStream(archiveBytes))) {
            ZipEntry entry;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                zipRecords += 1;
                if (zipRecords > MAX_ZIP_RECORDS) {
                    throw new IllegalArgumentException(
                            "ZIP archive structure is too large to import safely. Try importing a folder instead."
                    );
                }

                String relativePath = sanitizeRelativePath(entry.getName());
                if (relativePath == null || entry.isDirectory() || !isPdfPath(relativePath)) {
                    zipInputStream.closeEntry();
                    continue;
                }

                long declaredSize = entry.getSize();
                if (declaredSize > MAX_SINGLE_ENTRY_BYTES) {
                    throw new IllegalArgumentException("ZIP entry is too large: " + relativePath);
                }
                if (declaredSize > 0) {
                    totalUncompressed += declaredSize;
                    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
                        throw new IllegalArgumentException("ZIP archive exceeds the safe uncompressed size limit.");
                    }
                    if (entry.getCompressedSize() > 0) {
                        long ratio = declaredSize / Math.max(1, entry.getCompressedSize());
                        if (ratio > MAX_COMPRESSION_RATIO) {
                            throw new IllegalArgumentException("Suspicious compression ratio detected in ZIP entry: " + relativePath);
                        }
                    }
                }

                byte[] bytes = readLimited(zipInputStream, MAX_SINGLE_ENTRY_BYTES);
                if (!FileSignatureValidator.isPdf(bytes)) {
                    zipInputStream.closeEntry();
                    continue;
                }

                pdfEntries += 1;
                if (pdfEntries > MAX_PDF_ENTRIES) {
                    throw new IllegalArgumentException(
                            "ZIP archive contains too many PDF files (" + MAX_PDF_ENTRIES + " max). Split it into smaller ZIP files or import a folder instead."
                    );
                }
                totalUncompressed += bytes.length;
                if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
                    throw new IllegalArgumentException("ZIP archive exceeds the safe uncompressed size limit.");
                }
                if (entry.getCompressedSize() > 0) {
                    long ratio = bytes.length / Math.max(1, entry.getCompressedSize());
                    if (ratio > MAX_COMPRESSION_RATIO) {
                        throw new IllegalArgumentException("Suspicious compression ratio detected in ZIP entry: " + relativePath);
                    }
                }

                entries.add(new ExtractedEntry(relativePath, bytes));
                zipInputStream.closeEntry();
            }
        }

        if (entries.isEmpty()) {
            throw new IllegalArgumentException("ZIP archive does not contain any PDF files to import.");
        }
        return entries;
    }

    private static boolean isPdfPath(String relativePath) {
        return relativePath.toLowerCase(Locale.ROOT).endsWith(".pdf");
    }

    private static byte[] readLimited(InputStream inputStream, long maxBytes) throws IOException {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        long total = 0;
        int read;
        while ((read = inputStream.read(buffer)) >= 0) {
            total += read;
            if (total > maxBytes) {
                throw new IllegalArgumentException("ZIP entry exceeds the safe size limit.");
            }
            outputStream.write(buffer, 0, read);
        }
        return outputStream.toByteArray();
    }

    static String sanitizeRelativePath(String rawPath) {
        if (rawPath == null || rawPath.isBlank()) {
            return null;
        }
        String normalized = rawPath.replace('\\', '/').trim();
        while (normalized.startsWith("./")) {
            normalized = normalized.substring(2);
        }
        if (normalized.startsWith("/") || normalized.contains(":")) {
            throw new IllegalArgumentException("ZIP entry path is not allowed: " + rawPath);
        }
        if (normalized.contains("..")) {
            throw new IllegalArgumentException("ZIP entry path is not allowed: " + rawPath);
        }

        String lower = normalized.toLowerCase(Locale.ROOT);
        if (lower.startsWith("__macosx/")
                || lower.contains("/__macosx/")
                || lower.endsWith(".ds_store")
                || lower.endsWith("thumbs.db")
                || lower.endsWith("desktop.ini")
                || lower.endsWith(".tmp")
                || lower.endsWith(".zip")
                || lower.endsWith(".jar")
                || lower.endsWith(".7z")) {
            return null;
        }
        if (normalized.endsWith("/")) {
            return null;
        }
        if (normalized.length() > 240) {
            throw new IllegalArgumentException("ZIP entry path is too long.");
        }
        return normalized;
    }

    static String sanitizeFolderRelativePath(String rawPath) {
        if (rawPath == null || rawPath.isBlank()) {
            return null;
        }
        String normalized = rawPath.replace('\\', '/').trim();
        while (normalized.startsWith("./")) {
            normalized = normalized.substring(2);
        }
        if (normalized.startsWith("/") || normalized.contains(":") || normalized.contains("..")) {
            throw new IllegalArgumentException("Folder path is not allowed: " + rawPath);
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        if (lower.startsWith("__macosx/")
                || lower.contains("/__macosx/")
                || lower.endsWith(".ds_store")
                || lower.endsWith("thumbs.db")
                || lower.endsWith("desktop.ini")) {
            return null;
        }
        if (normalized.length() > 240) {
            throw new IllegalArgumentException("Folder path is too long.");
        }
        return normalized;
    }

    static boolean looksLikeZip(byte[] bytes, String filename, String contentType) {
        if (bytes != null && bytes.length >= 4) {
            return FileSignatureValidator.isZip(bytes);
        }
        return false;
    }

    static String decodePath(String encodedPath) {
        if (encodedPath == null) {
            return null;
        }
        return new String(encodedPath.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
    }
}
