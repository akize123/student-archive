package com.auca.archive.controller;

import com.auca.archive.service.AdminService;
import com.auca.archive.service.DocumentStructureMigrationService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/migrations")
public class AdminMigrationController {
    private final AdminService adminService;
    private final DocumentStructureMigrationService migrationService;

    public AdminMigrationController(
            AdminService adminService,
            DocumentStructureMigrationService migrationService
    ) {
        this.adminService = adminService;
        this.migrationService = migrationService;
    }

    @PostMapping("/document-structure")
    public DocumentStructureMigrationService.MigrationResult migrateDocumentStructure(
            @RequestHeader(value = "X-User-Role", required = false) String role
    ) {
        adminService.requireAdmin(role);
        return migrationService.migrateAll();
    }
}
