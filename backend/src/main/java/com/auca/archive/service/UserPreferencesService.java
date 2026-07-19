package com.auca.archive.service;

import com.auca.archive.dto.UpdateUserPreferencesRequest;
import com.auca.archive.dto.UserPreferencesResponse;
import com.auca.archive.model.UserPreferencesEntity;
import com.auca.archive.repository.UserPreferencesRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class UserPreferencesService {
    private static final String DEFAULT_COLOR_MODE = "auto";
    private static final String DEFAULT_DENSITY = "compact";

    private final UserPreferencesRepository repository;
    private final ObjectMapper objectMapper;

    public UserPreferencesService(UserPreferencesRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    public UserPreferencesResponse getPreferences(Long accountId) {
        return toResponse(findOrDefault(accountId));
    }

    @Transactional
    public UserPreferencesResponse updatePreferences(Long accountId, UpdateUserPreferencesRequest request) {
        Map<String, Object> current = readMap(findOrDefault(accountId).getPreferencesJson());
        if (request.folderColorMode() != null && !request.folderColorMode().isBlank()) {
            current.put("folderColorMode", request.folderColorMode().trim());
        }
        if (request.folderColors() != null) {
            current.put("folderColors", request.folderColors());
        }
        if (request.uiDensity() != null && !request.uiDensity().isBlank()) {
            current.put("uiDensity", request.uiDensity().trim());
        }

        UserPreferencesEntity entity = repository.findById(accountId).orElseGet(() -> {
            UserPreferencesEntity created = new UserPreferencesEntity();
            created.setAccountId(accountId);
            return created;
        });
        entity.setPreferencesJson(writeMap(current));
        entity.setUpdatedAt(LocalDateTime.now());
        return toResponse(repository.save(entity));
    }

    private UserPreferencesEntity findOrDefault(Long accountId) {
        return repository.findById(accountId).orElseGet(() -> {
            UserPreferencesEntity defaults = new UserPreferencesEntity();
            defaults.setAccountId(accountId);
            defaults.setPreferencesJson(defaultJson());
            return defaults;
        });
    }

    private UserPreferencesResponse toResponse(UserPreferencesEntity entity) {
        Map<String, Object> map = readMap(entity.getPreferencesJson());
        @SuppressWarnings("unchecked")
        Map<String, String> folderColors = map.get("folderColors") instanceof Map<?, ?> raw
                ? (Map<String, String>) raw
                : Map.of();
        return new UserPreferencesResponse(
                String.valueOf(map.getOrDefault("folderColorMode", DEFAULT_COLOR_MODE)),
                folderColors,
                String.valueOf(map.getOrDefault("uiDensity", DEFAULT_DENSITY))
        );
    }

    private Map<String, Object> readMap(String json) {
        if (json == null || json.isBlank()) {
            return defaultMap();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (JsonProcessingException ex) {
            return defaultMap();
        }
    }

    private String writeMap(Map<String, Object> map) {
        try {
            return objectMapper.writeValueAsString(map);
        } catch (JsonProcessingException ex) {
            return defaultJson();
        }
    }

    private Map<String, Object> defaultMap() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("folderColorMode", DEFAULT_COLOR_MODE);
        map.put("folderColors", Map.of());
        map.put("uiDensity", DEFAULT_DENSITY);
        return map;
    }

    private String defaultJson() {
        return writeMap(defaultMap());
    }
}
