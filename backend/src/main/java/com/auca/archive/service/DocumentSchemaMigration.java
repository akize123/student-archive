package com.auca.archive.service;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(0)
public class DocumentSchemaMigration implements CommandLineRunner {
    private final JdbcTemplate jdbcTemplate;

    public DocumentSchemaMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        jdbcTemplate.execute("ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check");
        jdbcTemplate.execute("""
                ALTER TABLE documents
                ADD CONSTRAINT documents_type_check
                CHECK (type IN ('PDF', 'DOCX', 'PPTX', 'XLSX', 'IMAGE', 'ZIP', 'OTHER'))
                """);
        jdbcTemplate.execute("ALTER TABLE documents ALTER COLUMN github_url TYPE TEXT");
        jdbcTemplate.execute("ALTER TABLE documents ALTER COLUMN external_links TYPE TEXT");
        jdbcTemplate.execute("ALTER TABLE documents ALTER COLUMN review_note TYPE TEXT");
        jdbcTemplate.execute("ALTER TABLE documents ALTER COLUMN cover_photo_path TYPE TEXT");
        jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS github_url TEXT");
        jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS external_links TEXT");
        jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS review_note TEXT");
        jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS cover_photo_path TEXT");
    }
}
