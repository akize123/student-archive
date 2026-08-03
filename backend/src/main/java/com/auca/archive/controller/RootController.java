package com.auca.archive.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class RootController {

    @GetMapping("/")
    public Map<String, String> root() {
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("application", "AUCA Smart Archive API");
        payload.put("status", "running");
        payload.put("frontend", "http://localhost:5173");
        payload.put("login", "http://localhost:5173/");
        payload.put("message", "Open the frontend URL in your browser. This port serves API requests only.");
        return payload;
    }
}
