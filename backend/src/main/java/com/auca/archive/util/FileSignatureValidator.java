package com.auca.archive.util;

import java.nio.charset.StandardCharsets;

public final class FileSignatureValidator {
    private static final byte[] PDF_SIGNATURE = "%PDF-".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] PNG_SIGNATURE = {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    };

    private FileSignatureValidator() {
    }

    public static void requirePdf(byte[] bytes) {
        if (!isPdf(bytes)) {
            throw new IllegalArgumentException("File is not a valid PDF (content does not match).");
        }
    }

    public static void requireZip(byte[] bytes) {
        if (!isZip(bytes)) {
            throw new IllegalArgumentException("File is not a valid ZIP archive (content does not match).");
        }
    }

    public static void requireImage(byte[] bytes) {
        if (!isImage(bytes)) {
            throw new IllegalArgumentException("File is not a valid image (content does not match). Use JPG, PNG, or WEBP.");
        }
    }

    public static boolean isPdf(byte[] bytes) {
        return startsWith(bytes, PDF_SIGNATURE);
    }

    public static boolean isZip(byte[] bytes) {
        if (bytes == null || bytes.length < 4) {
            return false;
        }
        return bytes[0] == 'P'
                && bytes[1] == 'K'
                && (bytes[2] == 0x03 || bytes[2] == 0x05 || bytes[2] == 0x07)
                && (bytes[3] == 0x04 || bytes[3] == 0x06 || bytes[3] == 0x08);
    }

    public static boolean isImage(byte[] bytes) {
        return isJpeg(bytes) || isPng(bytes) || isWebp(bytes);
    }

    private static boolean isJpeg(byte[] bytes) {
        return bytes != null
                && bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8
                && (bytes[2] & 0xFF) == 0xFF;
    }

    private static boolean isPng(byte[] bytes) {
        return startsWith(bytes, PNG_SIGNATURE);
    }

    private static boolean isWebp(byte[] bytes) {
        if (bytes == null || bytes.length < 12) {
            return false;
        }
        return bytes[0] == 'R'
                && bytes[1] == 'I'
                && bytes[2] == 'F'
                && bytes[3] == 'F'
                && bytes[8] == 'W'
                && bytes[9] == 'E'
                && bytes[10] == 'B'
                && bytes[11] == 'P';
    }

    private static boolean startsWith(byte[] bytes, byte[] signature) {
        if (bytes == null || bytes.length < signature.length) {
            return false;
        }
        for (int index = 0; index < signature.length; index += 1) {
            if (bytes[index] != signature[index]) {
                return false;
            }
        }
        return true;
    }
}
