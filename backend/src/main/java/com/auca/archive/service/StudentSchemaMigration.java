package com.auca.archive.service;

import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class StudentSchemaMigration implements CommandLineRunner {
    private final JdbcTemplate jdbcTemplate;

    public StudentSchemaMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        jdbcTemplate.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS registered_by_role VARCHAR(32)");
        jdbcTemplate.execute("""
                UPDATE students
                SET registered_by_role = 'REGISTRAR'
                WHERE registered_by_role IS NULL
                """);
    }
}
