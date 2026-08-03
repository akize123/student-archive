package com.auca.archive.service;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(0)
public class ShareSchemaMigration implements CommandLineRunner {
    private final JdbcTemplate jdbcTemplate;

    public ShareSchemaMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        jdbcTemplate.execute("ALTER TABLE folder_shares ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP");
        jdbcTemplate.execute("ALTER TABLE folder_shares ADD COLUMN IF NOT EXISTS allow_reshare BOOLEAN");
        jdbcTemplate.execute("""
                UPDATE folder_shares
                SET allow_reshare = FALSE
                WHERE allow_reshare IS NULL
                """);
        jdbcTemplate.execute("ALTER TABLE folder_shares ALTER COLUMN allow_reshare SET DEFAULT FALSE");
        jdbcTemplate.execute("ALTER TABLE folder_shares DROP CONSTRAINT IF EXISTS folder_shares_permission_check");
        jdbcTemplate.execute("""
                ALTER TABLE folder_shares
                ADD CONSTRAINT folder_shares_permission_check
                CHECK (permission IN ('VIEW_ONLY', 'READ_ONLY', 'WRITE', 'EDIT'))
                """);
    }
}
