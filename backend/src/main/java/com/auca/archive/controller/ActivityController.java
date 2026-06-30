package com.auca.archive.controller;

import com.auca.archive.dto.ActivityResponse;
import com.auca.archive.service.ActivityService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/activity")
public class ActivityController {
    private final ActivityService activityService;

    public ActivityController(ActivityService activityService) {
        this.activityService = activityService;
    }

    @GetMapping
    public List<ActivityResponse> recent(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestParam(required = false) String scope,
            @RequestParam(required = false) String topic
    ) {
        return activityService.recent(role, scope, topic);
    }
}
