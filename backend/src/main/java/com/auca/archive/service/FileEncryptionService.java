package com.auca.archive.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Service
public class FileEncryptionService {
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_BYTES = 12;

    private final boolean enabled;
    private final SecretKey secretKey;

    public FileEncryptionService(
            @Value("${archive.encryption.enabled:true}") boolean enabled,
            @Value("${archive.encryption.key-base64:}") String keyBase64,
            @Value("${archive.encryption.passphrase:auca-archive-dev-key-change-me}") String passphrase
    ) {
        this.enabled = enabled;
        this.secretKey = buildKey(keyBase64, passphrase);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public EncryptedPayload encrypt(byte[] plainBytes) {
        if (!enabled) {
            return new EncryptedPayload(plainBytes, null);
        }
        try {
            byte[] iv = new byte[IV_BYTES];
            SecureRandom.getInstanceStrong().nextBytes(iv);
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] cipherText = cipher.doFinal(plainBytes);
            return new EncryptedPayload(cipherText, Base64.getEncoder().encodeToString(iv));
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to encrypt document", ex);
        }
    }

    public byte[] decrypt(byte[] storedBytes, String ivBase64) {
        if (!enabled || ivBase64 == null || ivBase64.isBlank()) {
            return storedBytes;
        }
        try {
            byte[] iv = Base64.getDecoder().decode(ivBase64);
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            return cipher.doFinal(storedBytes);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to decrypt document", ex);
        }
    }

    private SecretKey buildKey(String keyBase64, String passphrase) {
        try {
            if (keyBase64 != null && !keyBase64.isBlank()) {
                byte[] raw = Base64.getDecoder().decode(keyBase64.trim());
                if (raw.length != 16 && raw.length != 24 && raw.length != 32) {
                    throw new IllegalArgumentException("archive.encryption.key-base64 must decode to 16, 24, or 32 bytes");
                }
                return new SecretKeySpec(raw, "AES");
            }
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] derived = digest.digest(passphrase.getBytes(StandardCharsets.UTF_8));
            return new SecretKeySpec(derived, "AES");
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to initialize encryption key", ex);
        }
    }

    public record EncryptedPayload(byte[] bytes, String ivBase64) {
    }
}
