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
    }
}
