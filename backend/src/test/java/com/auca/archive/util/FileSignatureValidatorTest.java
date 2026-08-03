package com.auca.archive.util;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FileSignatureValidatorTest {
    @Test
    void acceptsPdfHeader() {
        byte[] bytes = "%PDF-1.4\n".getBytes(StandardCharsets.US_ASCII);
        assertTrue(FileSignatureValidator.isPdf(bytes));
        assertDoesNotThrow(() -> FileSignatureValidator.requirePdf(bytes));
    }

    @Test
    void rejectsTextClaimingToBePdf() {
        byte[] bytes = "not a pdf".getBytes(StandardCharsets.US_ASCII);
        assertFalse(FileSignatureValidator.isPdf(bytes));
        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> FileSignatureValidator.requirePdf(bytes)
        );
        assertTrue(error.getMessage().contains("not a valid PDF"));
    }

    @Test
    void acceptsZipLocalHeader() {
        byte[] bytes = new byte[] {'P', 'K', 0x03, 0x04, 0x00};
        assertTrue(FileSignatureValidator.isZip(bytes));
        assertDoesNotThrow(() -> FileSignatureValidator.requireZip(bytes));
    }

    @Test
    void rejectsExtensionOnlyZipClaim() {
        byte[] bytes = "plain text".getBytes(StandardCharsets.US_ASCII);
        assertFalse(FileSignatureValidator.isZip(bytes));
        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> FileSignatureValidator.requireZip(bytes)
        );
        assertTrue(error.getMessage().contains("not a valid ZIP"));
    }

    @Test
    void acceptsJpegPngAndWebpHeaders() {
        byte[] jpeg = new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x00};
        byte[] png = new byte[] {
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00
        };
        byte[] webp = "RIFFxxxxWEBP".getBytes(StandardCharsets.US_ASCII);

        assertTrue(FileSignatureValidator.isImage(jpeg));
        assertTrue(FileSignatureValidator.isImage(png));
        assertTrue(FileSignatureValidator.isImage(webp));
        assertDoesNotThrow(() -> FileSignatureValidator.requireImage(jpeg));
    }

    @Test
    void rejectsNonImageBytes() {
        byte[] bytes = "hello".getBytes(StandardCharsets.US_ASCII);
        assertFalse(FileSignatureValidator.isImage(bytes));
        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> FileSignatureValidator.requireImage(bytes)
        );
        assertTrue(error.getMessage().contains("not a valid image"));
    }
}
