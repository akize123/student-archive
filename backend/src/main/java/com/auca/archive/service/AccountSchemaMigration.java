package com.auca.archive.service;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(0)
public class AccountSchemaMigration implements CommandLineRunner {
    private final JdbcTemplate jdbcTemplate;

    public AccountSchemaMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        jdbcTemplate.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS student_number VARCHAR(64)");
        jdbcTemplate.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS access_version BIGINT DEFAULT 0");
        jdbcTemplate.execute("""
                UPDATE accounts
                SET access_version = 0
                WHERE access_version IS NULL
                """);
        jdbcTemplate.execute("ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_role_check");
        // H2 can treat CHECK domains as enum types; widen to VARCHAR before adding FINANCE.
        try {
            jdbcTemplate.execute("ALTER TABLE accounts ALTER COLUMN user_role VARCHAR(32)");
        } catch (Exception ignored) {
            // Column may already be plain VARCHAR on fresh databases.
        }
        jdbcTemplate.execute("""
                ALTER TABLE accounts
                ADD CONSTRAINT accounts_user_role_check
                CHECK (user_role IN ('ADMIN', 'REGISTRAR', 'FINANCE', 'EXAMINATION_OFFICER', 'HOD', 'DEAN_OF_FACULTY', 'LIBRARIAN', 'STUDENT'))
                """);
    }
}
