package com.auca.archive.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;

import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class MutableHeaderHttpServletRequest extends HttpServletRequestWrapper {
    private final Map<String, String> headers = new LinkedHashMap<>();

    MutableHeaderHttpServletRequest(HttpServletRequest request) {
        super(request);
    }

    void setHeader(String name, String value) {
        if (name == null || name.isBlank()) {
            return;
        }
        headers.put(name.toLowerCase(Locale.ROOT), value);
    }

    @Override
    public String getHeader(String name) {
        if (name == null) {
            return null;
        }
        String override = headers.get(name.toLowerCase(Locale.ROOT));
        return override != null ? override : super.getHeader(name);
    }

    @Override
    public Enumeration<String> getHeaders(String name) {
        String value = getHeader(name);
        return value == null ? Collections.emptyEnumeration() : Collections.enumeration(List.of(value));
    }

    @Override
    public Enumeration<String> getHeaderNames() {
        Map<String, String> merged = new LinkedHashMap<>();
        Enumeration<String> existing = super.getHeaderNames();
        while (existing.hasMoreElements()) {
            String name = existing.nextElement();
            merged.put(name.toLowerCase(Locale.ROOT), name);
        }
        headers.keySet().forEach(key -> merged.putIfAbsent(key, key));
        return Collections.enumeration(merged.values());
    }
}
