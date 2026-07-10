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
        jdbcTemplate.execute("ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_role_check");
        jdbcTemplate.execute("""
                ALTER TABLE accounts
                ADD CONSTRAINT accounts_user_role_check
                CHECK (user_role IN ('ADMIN', 'REGISTRAR', 'EXAMINATION_OFFICER', 'HOD', 'STUDENT'))
                """);
    }
}
