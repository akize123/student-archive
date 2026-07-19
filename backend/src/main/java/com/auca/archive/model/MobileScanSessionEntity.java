package com.auca.archive.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "mobile_scan_sessions")
public class MobileScanSessionEntity {
    @Id
    private String token;

    private LocalDateTime expiresAt;
    private boolean ready;

    @Lob
    private byte[] pdfBytes;

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    public boolean isReady() {
        return ready;
    }

    public void setReady(boolean ready) {
        this.ready = ready;
    }

    public byte[] getPdfBytes() {
        return pdfBytes;
    }

    public void setPdfBytes(byte[] pdfBytes) {
        this.pdfBytes = pdfBytes;
    }
}
