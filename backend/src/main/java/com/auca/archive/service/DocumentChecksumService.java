package com.auca.archive.service;

import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.util.HexFormat;

@Service
public class DocumentChecksumService {
    public String sha256Hex(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to compute checksum", ex);
        }
    }

    public boolean matches(String expected, byte[] bytes) {
        if (expected == null || expected.isBlank()) {
            return false;
        }
        return expected.equalsIgnoreCase(sha256Hex(bytes));
    }
}
