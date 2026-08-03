package com.auca.archive.controller;

import com.auca.archive.dto.MobileScanNetworkResponse;
import com.auca.archive.dto.MobileScanPageResponse;
import com.auca.archive.dto.MobileScanReorderRequest;
import com.auca.archive.dto.MobileScanSessionResponse;
import com.auca.archive.service.MobileScanSessionService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/mobile-scan")
public class MobileScanController {
    private final MobileScanSessionService mobileScanSessionService;

    public MobileScanController(MobileScanSessionService mobileScanSessionService) {
        this.mobileScanSessionService = mobileScanSessionService;
    }

    @PostMapping("/sessions")
    public MobileScanSessionResponse createSession() {
        return mobileScanSessionService.createSession();
    }

    @GetMapping("/network-url")
    public MobileScanNetworkResponse networkUrl(
            @org.springframework.web.bind.annotation.RequestParam(name = "frontendPort", defaultValue = "5173") int frontendPort
    ) {
        return mobileScanSessionService.getNetworkResponse(frontendPort);
    }

    @GetMapping("/sessions/{token}")
    public MobileScanSessionResponse getSession(@PathVariable String token) {
        return mobileScanSessionService.getSession(token);
    }

    @PostMapping(value = "/sessions/{token}/pages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MobileScanPageResponse addPage(
            @PathVariable String token,
            @RequestPart("image") MultipartFile image
    ) throws IOException {
        return mobileScanSessionService.addPage(token, image);
    }

    @PutMapping("/sessions/{token}/pages/reorder")
    public MobileScanSessionResponse reorderPages(
            @PathVariable String token,
            @RequestBody MobileScanReorderRequest request
    ) {
        return mobileScanSessionService.reorderPages(token, request);
    }

    @DeleteMapping("/sessions/{token}/pages/{pageId}")
    public MobileScanSessionResponse deletePage(
            @PathVariable String token,
            @PathVariable String pageId
    ) {
        mobileScanSessionService.deletePage(token, pageId);
        return mobileScanSessionService.getSession(token);
    }

    @PostMapping("/sessions/{token}/finalize")
    public MobileScanSessionResponse finalizeSession(@PathVariable String token) throws IOException {
        return mobileScanSessionService.finalizeSession(token);
    }

    @GetMapping("/sessions/{token}/pdf")
    public ResponseEntity<byte[]> downloadPdf(@PathVariable String token) {
        byte[] pdf = mobileScanSessionService.getPdf(token);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"phone-scan.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
