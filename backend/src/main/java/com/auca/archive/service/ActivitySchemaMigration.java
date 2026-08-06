package com.auca.archive.service;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class ActivitySchemaMigration implements CommandLineRunner {
    private final JdbcTemplate jdbcTemplate;

    public ActivitySchemaMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        jdbcTemplate.execute("ALTER TABLE activities ADD COLUMN IF NOT EXISTS actor_account_id BIGINT");
        jdbcTemplate.execute("ALTER TABLE activities ADD COLUMN IF NOT EXISTS actor_username VARCHAR(120)");
        widenRoleColumn("activities", "source_role");
        widenRoleColumn("activities", "target_role");
    }

    private void widenRoleColumn(String table, String column) {
        String constraint = table + "_" + column + "_check";
        jdbcTemplate.execute("ALTER TABLE " + table + " DROP CONSTRAINT IF EXISTS " + constraint);
        try {
            jdbcTemplate.execute("ALTER TABLE " + table + " ALTER COLUMN " + column + " VARCHAR(32)");
        } catch (Exception ignored) {
            // Column may already be plain VARCHAR on fresh databases.
        }
        jdbcTemplate.execute("""
                ALTER TABLE %s
                ADD CONSTRAINT %s
                CHECK (%s IN ('ADMIN', 'REGISTRAR', 'FINANCE', 'EXAMINATION_OFFICER', 'HOD', 'DEAN_OF_FACULTY', 'LIBRARIAN', 'STUDENT'))
                """.formatted(table, constraint, column));
    }
}
