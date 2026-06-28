package com.auca.archive.service;

import com.auca.archive.domain.UserRole;
import com.auca.archive.dto.ActivityResponse;
import com.auca.archive.model.ActivityEntryEntity;
import com.auca.archive.repository.ActivityEntryRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ActivityService {
    private final ActivityEntryRepository activityEntryRepository;
    private final ArchiveAccessService accessService;

    public ActivityService(ActivityEntryRepository activityEntryRepository, ArchiveAccessService accessService) {
        this.activityEntryRepository = activityEntryRepository;
        this.accessService = accessService;
    }

    public List<ActivityResponse> recent() {
        return recent(null);
    }

    public List<ActivityResponse> recent(String rawRole) {
        UserRole role = rawRole == null || rawRole.isBlank() ? null : accessService.resolveRole(rawRole);
        return activityEntryRepository.findTop6ByOrderByCreatedAtDesc()
                .stream()
                .filter(entry -> accessService.isActivityRelevant(entry, role))
                .map(this::toResponse)
                .toList();
    }

    private ActivityResponse toResponse(ActivityEntryEntity entry) {
        return new ActivityResponse(
                entry.getId(),
                entry.getMessage(),
                entry.getActor(),
                entry.getCategory() == null ? "" : entry.getCategory().name(),
                entry.getCreatedAt()
        );
    }
}
