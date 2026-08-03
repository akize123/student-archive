package com.auca.archive.service;

import com.auca.archive.dto.MobileScanNetworkResponse;
import com.auca.archive.util.FileSignatureValidator;
import com.auca.archive.dto.MobileScanPageResponse;
import com.auca.archive.dto.MobileScanReorderRequest;
import com.auca.archive.dto.MobileScanSessionResponse;
import com.auca.archive.model.MobileScanPageEntity;
import com.auca.archive.model.MobileScanSessionEntity;
import com.auca.archive.repository.MobileScanPageRepository;
import com.auca.archive.repository.MobileScanSessionRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class MobileScanSessionService {
    private static final int SESSION_MINUTES = 20;

    private final MobileScanSessionRepository sessionRepository;
    private final MobileScanPageRepository pageRepository;
    private final int apiPort;

    public MobileScanSessionService(
            MobileScanSessionRepository sessionRepository,
            MobileScanPageRepository pageRepository,
            @Value("${server.port:8081}") int apiPort
    ) {
        this.sessionRepository = sessionRepository;
        this.pageRepository = pageRepository;
        this.apiPort = apiPort;
    }

    public MobileScanNetworkResponse getNetworkResponse(int frontendPort) {
        String host = resolveLanHost();
        if (host == null || host.isBlank()) {
            throw new IllegalStateException("Could not detect a local network address. Connect this computer to Wi-Fi and try again.");
        }
        int safeFrontendPort = frontendPort > 0 ? frontendPort : 5173;
        return new MobileScanNetworkResponse(
                host,
                safeFrontendPort,
                apiPort,
                "http://" + host + ":" + safeFrontendPort,
                "http://" + host + ":" + apiPort
        );
    }

    @Transactional
    public MobileScanSessionResponse createSession() {
        cleanupExpired();
        String token = UUID.randomUUID().toString().replace("-", "");
        MobileScanSessionEntity session = new MobileScanSessionEntity();
        session.setToken(token);
        session.setExpiresAt(LocalDateTime.now().plusMinutes(SESSION_MINUTES));
        session.setReady(false);
        sessionRepository.save(session);
        return toResponse(session, List.of());
    }

    public MobileScanSessionResponse getSession(String token) {
        MobileScanSessionEntity session = requireSession(token);
        return toResponse(session, loadPages(token));
    }

    @Transactional
    public MobileScanPageResponse addPage(String token, MultipartFile file) throws IOException {
        MobileScanSessionEntity session = requireSession(token);
        if (session.isReady()) {
            throw new IllegalArgumentException("This scan session is already finalized.");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Page image is required.");
        }

        byte[] bytes = file.getBytes();
        FileSignatureValidator.requireImage(bytes);
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
        if (image == null) {
            throw new IllegalArgumentException("Only image files can be uploaded as scan pages.");
        }

        List<MobileScanPageEntity> pages = loadPages(token);
        String pageId = UUID.randomUUID().toString().replace("-", "");
        MobileScanPageEntity page = new MobileScanPageEntity();
        page.setSessionToken(token);
        page.setPageId(pageId);
        page.setPageOrder(pages.size() + 1);
        page.setImageBytes(bytes);
        pageRepository.save(page);

        session.setReady(false);
        session.setPdfBytes(null);
        sessionRepository.save(session);
        return new MobileScanPageResponse(pageId, page.getPageOrder());
    }

    @Transactional
    public MobileScanSessionResponse reorderPages(String token, MobileScanReorderRequest request) {
        MobileScanSessionEntity session = requireSession(token);
        if (session.isReady()) {
            throw new IllegalArgumentException("This scan session is already finalized.");
        }
        if (request == null || request.pageIds() == null || request.pageIds().isEmpty()) {
            throw new IllegalArgumentException("Page order is required.");
        }

        List<MobileScanPageEntity> pages = loadPages(token);
        if (request.pageIds().size() != pages.size()) {
            throw new IllegalArgumentException("Provide every page id when reordering.");
        }

        Map<String, MobileScanPageEntity> byId = new LinkedHashMap<>();
        pages.forEach(page -> byId.put(page.getPageId(), page));

        int order = 1;
        for (String pageId : request.pageIds()) {
            MobileScanPageEntity page = byId.get(pageId);
            if (page == null) {
                throw new IllegalArgumentException("Unknown page id: " + pageId);
            }
            page.setPageOrder(order++);
            pageRepository.save(page);
        }

        session.setPdfBytes(null);
        session.setReady(false);
        sessionRepository.save(session);
        return toResponse(session, loadPages(token));
    }

    @Transactional
    public MobileScanSessionResponse deletePage(String token, String pageId) {
        MobileScanSessionEntity session = requireSession(token);
        if (session.isReady()) {
            throw new IllegalArgumentException("This scan session is already finalized.");
        }

        List<MobileScanPageEntity> pages = loadPages(token);
        MobileScanPageEntity target = pages.stream()
                .filter(page -> page.getPageId().equals(pageId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Page not found."));
        pageRepository.delete(target);
        renumberPages(loadPages(token));

        session.setPdfBytes(null);
        session.setReady(false);
        sessionRepository.save(session);
        return toResponse(session, loadPages(token));
    }

    @Transactional
    public MobileScanSessionResponse finalizeSession(String token) throws IOException {
        MobileScanSessionEntity session = requireSession(token);
        List<MobileScanPageEntity> pages = loadPages(token);
        if (pages.isEmpty()) {
            throw new IllegalArgumentException("Add at least one scanned page before finishing.");
        }
        session.setPdfBytes(buildPdf(pages));
        session.setReady(true);
        sessionRepository.save(session);
        return toResponse(session, pages);
    }

    public byte[] getPdf(String token) {
        MobileScanSessionEntity session = requireSession(token);
        if (!session.isReady() || session.getPdfBytes() == null) {
            throw new IllegalArgumentException("The scanned PDF is not ready yet.");
        }
        return session.getPdfBytes();
    }

    private byte[] buildPdf(List<MobileScanPageEntity> pages) throws IOException {
        List<MobileScanPageEntity> ordered = pages.stream()
                .sorted(Comparator.comparingInt(MobileScanPageEntity::getPageOrder))
                .toList();

        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            for (MobileScanPageEntity page : ordered) {
                BufferedImage image = ImageIO.read(new ByteArrayInputStream(page.getImageBytes()));
                if (image == null) {
                    continue;
                }
                float imageWidth = image.getWidth();
                float imageHeight = image.getHeight();
                PDPage pdfPage = new PDPage(new PDRectangle(imageWidth, imageHeight));
                document.addPage(pdfPage);
                PDImageXObject pdImage = LosslessFactory.createFromImage(document, image);
                try (PDPageContentStream contentStream = new PDPageContentStream(document, pdfPage)) {
                    contentStream.drawImage(pdImage, 0, 0, imageWidth, imageHeight);
                }
            }
            document.save(output);
            return output.toByteArray();
        }
    }

    private void renumberPages(List<MobileScanPageEntity> pages) {
        List<MobileScanPageEntity> ordered = pages.stream()
                .sorted(Comparator.comparingInt(MobileScanPageEntity::getPageOrder))
                .toList();
        int order = 1;
        for (MobileScanPageEntity page : ordered) {
            page.setPageOrder(order++);
            pageRepository.save(page);
        }
    }

    private MobileScanSessionEntity requireSession(String token) {
        cleanupExpired();
        return sessionRepository.findById(token)
                .filter(session -> session.getExpiresAt().isAfter(LocalDateTime.now()))
                .orElseThrow(() -> new IllegalArgumentException("Scan session not found or expired."));
    }

    private List<MobileScanPageEntity> loadPages(String token) {
        return pageRepository.findBySessionTokenOrderByPageOrderAsc(token);
    }

    private void cleanupExpired() {
        LocalDateTime cutoff = LocalDateTime.now();
        List<MobileScanSessionEntity> expired = sessionRepository.findAll().stream()
                .filter(session -> session.getExpiresAt().isBefore(cutoff))
                .toList();
        for (MobileScanSessionEntity session : expired) {
            pageRepository.deleteBySessionToken(session.getToken());
            sessionRepository.delete(session);
        }
    }

    private String resolveLanHost() {
        record Candidate(String host, int priority) {}
        List<Candidate> candidates = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();
                String interfaceName = networkInterface.getDisplayName().toLowerCase();
                if (!networkInterface.isUp() || networkInterface.isLoopback() || networkInterface.isVirtual()) {
                    continue;
                }
                if (isLikelyVirtualInterface(interfaceName)) {
                    continue;
                }
                Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress address = addresses.nextElement();
                    if (!(address instanceof Inet4Address) || address.isLoopbackAddress() || address.isLinkLocalAddress()) {
                        continue;
                    }
                    String host = address.getHostAddress();
                    if (host != null && !host.isBlank()) {
                        candidates.add(new Candidate(host, lanHostPriority(host, interfaceName)));
                    }
                }
            }
        } catch (SocketException ignored) {
            return null;
        }
        return candidates.stream()
                .min(Comparator.comparingInt(Candidate::priority))
                .map(Candidate::host)
                .orElse(null);
    }

    private boolean isLikelyVirtualInterface(String interfaceName) {
        return interfaceName.contains("virtual")
                || interfaceName.contains("vmware")
                || interfaceName.contains("virtualbox")
                || interfaceName.contains("hyper-v")
                || interfaceName.contains("vethernet")
                || interfaceName.contains("docker")
                || interfaceName.contains("tunnel")
                || interfaceName.contains("vpn")
                || interfaceName.contains("loopback");
    }

    private boolean isLikelyVirtualSubnet(String host) {
        return host.startsWith("192.168.56.")
                || host.startsWith("192.168.122.")
                || host.startsWith("192.168.59.");
    }

    private int lanHostPriority(String host, String interfaceName) {
        if (isLikelyVirtualSubnet(host)) {
            return 20;
        }
        if (interfaceName.contains("wi-fi") || interfaceName.contains("wifi") || interfaceName.contains("wlan")) {
            return 0;
        }
        if (host.startsWith("192.168.")) {
            return 1;
        }
        if (host.startsWith("10.")) {
            return 2;
        }
        if (host.startsWith("172.")) {
            String[] parts = host.split("\\.");
            if (parts.length >= 2) {
                try {
                    int secondOctet = Integer.parseInt(parts[1]);
                    if (secondOctet >= 16 && secondOctet <= 31) {
                        return 3;
                    }
                } catch (NumberFormatException ignored) {
                    return 5;
                }
            }
        }
        return 4;
    }

    private MobileScanSessionResponse toResponse(MobileScanSessionEntity session, List<MobileScanPageEntity> pages) {
        List<MobileScanPageResponse> pageResponses = pages.stream()
                .sorted(Comparator.comparingInt(MobileScanPageEntity::getPageOrder))
                .map(page -> new MobileScanPageResponse(page.getPageId(), page.getPageOrder()))
                .toList();
        String status = session.isReady() ? "READY" : pageResponses.isEmpty() ? "WAITING" : "IN_PROGRESS";
        return new MobileScanSessionResponse(
                session.getToken(),
                session.getExpiresAt(),
                status,
                session.isReady(),
                pageResponses.size(),
                pageResponses
        );
    }
}
