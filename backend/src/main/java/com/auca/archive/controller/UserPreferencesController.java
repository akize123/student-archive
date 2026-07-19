package com.auca.archive.controller;

import com.auca.archive.dto.UpdateUserPreferencesRequest;
import com.auca.archive.dto.UserPreferencesResponse;
import com.auca.archive.service.UserPreferencesService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/users/me")
public class UserPreferencesController {
    private final UserPreferencesService preferencesService;

    public UserPreferencesController(UserPreferencesService preferencesService) {
        this.preferencesService = preferencesService;
    }

    @GetMapping("/preferences")
    public UserPreferencesResponse preferences(@RequestHeader(value = "X-Account-Id", required = false) String accountId) {
        return preferencesService.getPreferences(requireAccountId(accountId));
    }

    @PatchMapping("/preferences")
    public UserPreferencesResponse updatePreferences(
            @RequestBody UpdateUserPreferencesRequest request,
            @RequestHeader(value = "X-Account-Id", required = false) String accountId
    ) {
        return preferencesService.updatePreferences(requireAccountId(accountId), request);
    }

    private Long requireAccountId(String accountId) {
        if (accountId == null || accountId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in again.");
        }
        try {
            return Long.parseLong(accountId.trim());
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in again.");
        }
    }
}
