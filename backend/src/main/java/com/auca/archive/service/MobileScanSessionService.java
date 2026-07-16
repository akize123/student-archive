package com.auca.archive.service;

import com.auca.archive.dto.MobileScanNetworkResponse;
import com.auca.archive.util.FileSignatureValidator;
import com.auca.archive.dto.MobileScanPageResponse;
import com.auca.archive.dto.MobileScanReorderRequest;
import com.auca.archive.dto.MobileScanSessionResponse;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
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
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MobileScanSessionService {
    private static final int SESSION_MINUTES = 20;

    private final Map<String, SessionState> sessions = new ConcurrentHashMap<>();
    private final int apiPort;

    public MobileScanSessionService(@Value("${server.port:8081}") int apiPort) {
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

    public MobileScanSessionResponse createSession() {
        cleanupExpired();
        String token = UUID.randomUUID().toString().replace("-", "");
        SessionState session = new SessionState(token, LocalDateTime.now().plusMinutes(SESSION_MINUTES));
        sessions.put(token, session);
        return toResponse(session);
    }

    public MobileScanSessionResponse getSession(String token) {
        SessionState session = requireSession(token);
        return toResponse(session);
    }

    public MobileScanPageResponse addPage(String token, MultipartFile file) throws IOException {
        SessionState session = requireSession(token);
        if (session.ready) {
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

        String pageId = UUID.randomUUID().toString().replace("-", "");
        session.pages.put(pageId, new PageEntry(pageId, session.pages.size() + 1, bytes));
        session.ready = false;
        session.pdfBytes = null;
        return new MobileScanPageResponse(pageId, session.pages.get(pageId).order());
    }

    public MobileScanSessionResponse reorderPages(String token, MobileScanReorderRequest request) {
        SessionState session = requireSession(token);
        if (session.ready) {
            throw new IllegalArgumentException("This scan session is already finalized.");
        }
        if (request == null || request.pageIds() == null || request.pageIds().isEmpty()) {
            throw new IllegalArgumentException("Page order is required.");
        }

        List<String> requested = request.pageIds();
        if (requested.size() != session.pages.size()) {
            throw new IllegalArgumentException("Provide every page id when reordering.");
        }

        Map<String, PageEntry> nextPages = new LinkedHashMap<>();
        int order = 1;
        for (String pageId : requested) {
            PageEntry page = session.pages.get(pageId);
            if (page == null) {
                throw new IllegalArgumentException("Unknown page id: " + pageId);
            }
            nextPages.put(pageId, new PageEntry(page.id(), order++, page.imageBytes()));
        }
        session.pages.clear();
        session.pages.putAll(nextPages);
        session.pdfBytes = null;
        return toResponse(session);
    }

    public void deletePage(String token, String pageId) {
        SessionState session = requireSession(token);
        if (session.ready) {
            throw new IllegalArgumentException("This scan session is already finalized.");
        }
        if (session.pages.remove(pageId) == null) {
            throw new IllegalArgumentException("Page not found.");
        }
        renumberPages(session);
        session.pdfBytes = null;
    }

    public MobileScanSessionResponse finalizeSession(String token) throws IOException {
        SessionState session = requireSession(token);
        if (session.pages.isEmpty()) {
            throw new IllegalArgumentException("Add at least one scanned page before finishing.");
        }
        session.pdfBytes = buildPdf(session);
        session.ready = true;
        return toResponse(session);
    }

    public byte[] getPdf(String token) {
        SessionState session = requireSession(token);
        if (!session.ready || session.pdfBytes == null) {
            throw new IllegalArgumentException("The scanned PDF is not ready yet.");
        }
        return session.pdfBytes;
    }

    private byte[] buildPdf(SessionState session) throws IOException {
        List<PageEntry> ordered = session.pages.values().stream()
                .sorted(Comparator.comparingInt(PageEntry::order))
                .toList();

        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            for (PageEntry page : ordered) {
                BufferedImage image = ImageIO.read(new ByteArrayInputStream(page.imageBytes()));
                if (image == null) {
                    continue;
                }
                float width = image.getWidth();
                float height = image.getHeight();
                PDPage pdfPage = new PDPage(new PDRectangle(width, height));
                document.addPage(pdfPage);
                PDImageXObject pdImage = LosslessFactory.createFromImage(document, image);
                try (PDPageContentStream contentStream = new PDPageContentStream(document, pdfPage)) {
                    contentStream.drawImage(pdImage, 0, 0, width, height);
                }
            }
            document.save(output);
            return output.toByteArray();
        }
    }

    private void renumberPages(SessionState session) {
        List<PageEntry> ordered = session.pages.values().stream()
                .sorted(Comparator.comparingInt(PageEntry::order))
                .toList();
        session.pages.clear();
        int order = 1;
        for (PageEntry page : ordered) {
            session.pages.put(page.id(), new PageEntry(page.id(), order++, page.imageBytes()));
        }
    }

    private SessionState requireSession(String token) {
        cleanupExpired();
        SessionState session = sessions.get(token);
        if (session == null) {
            throw new IllegalArgumentException("Scan session not found or expired.");
        }
        if (session.expiresAt.isBefore(LocalDateTime.now())) {
            sessions.remove(token);
            throw new IllegalArgumentException("Scan session expired. Start a new phone scan.");
        }
        return session;
    }

    private void cleanupExpired() {
        LocalDateTime now = LocalDateTime.now();
        sessions.entrySet().removeIf(entry -> entry.getValue().expiresAt.isBefore(now));
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

    private MobileScanSessionResponse toResponse(SessionState session) {
        List<MobileScanPageResponse> pages = session.pages.values().stream()
                .sorted(Comparator.comparingInt(PageEntry::order))
                .map(page -> new MobileScanPageResponse(page.id(), page.order()))
                .toList();
        String status = session.ready ? "READY" : pages.isEmpty() ? "WAITING" : "IN_PROGRESS";
        return new MobileScanSessionResponse(
                session.token,
                session.expiresAt,
                status,
                session.ready,
                pages.size(),
                pages
        );
    }

    private static final class SessionState {
        private final String token;
        private final LocalDateTime expiresAt;
        private final Map<String, PageEntry> pages = new LinkedHashMap<>();
        private boolean ready;
        private byte[] pdfBytes;

        private SessionState(String token, LocalDateTime expiresAt) {
            this.token = token;
            this.expiresAt = expiresAt;
        }
    }

    private record PageEntry(String id, int order, byte[] imageBytes) {
    }
}
