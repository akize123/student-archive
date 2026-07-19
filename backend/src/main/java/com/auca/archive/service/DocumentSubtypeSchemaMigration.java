package com.auca.archive.service;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class DocumentSubtypeSchemaMigration implements CommandLineRunner {
    private final JdbcTemplate jdbcTemplate;

    public DocumentSubtypeSchemaMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS document_subtypes (
                    id BIGSERIAL PRIMARY KEY,
                    category VARCHAR(64) NOT NULL,
                    name VARCHAR(160) NOT NULL,
                    code VARCHAR(32),
                    department VARCHAR(160),
                    description TEXT,
                    required_keywords_json TEXT,
                    min_pages INTEGER,
                    max_pages INTEGER,
                    active BOOLEAN DEFAULT TRUE,
                    created_by VARCHAR(120),
                    created_at TIMESTAMP
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS document_templates (
                    id BIGSERIAL PRIMARY KEY,
                    category VARCHAR(64) NOT NULL,
                    document_subtype_id BIGINT,
                    department VARCHAR(160),
                    title VARCHAR(255) NOT NULL,
                    file_path TEXT,
                    encryption_iv TEXT,
                    baseline_text TEXT,
                    baseline_text_hash VARCHAR(64),
                    page_count INTEGER,
                    ocr_method VARCHAR(32),
                    similarity_threshold INTEGER DEFAULT 80,
                    active BOOLEAN DEFAULT TRUE,
                    uploaded_by_account_id BIGINT,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP
                )
                """);
        jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_subtype_id BIGINT");
        jdbcTemplate.execute("ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS document_type_name VARCHAR(160)");
        jdbcTemplate.execute("ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS office VARCHAR(120)");
        jdbcTemplate.execute("ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS faculty VARCHAR(160)");
        jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_type_id BIGINT");
        jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_checksum_sha256 VARCHAR(64)");
        jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS checksum_algorithm VARCHAR(16)");
        jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS compressed BOOLEAN DEFAULT FALSE");
        jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_size_bytes BIGINT");
        jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS converted_from_mime VARCHAR(120)");
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS document_category_definitions (
                    id BIGSERIAL PRIMARY KEY,
                    name VARCHAR(160) NOT NULL,
                    code VARCHAR(32),
                    office VARCHAR(120),
                    faculty VARCHAR(160),
                    department VARCHAR(160),
                    legacy_category VARCHAR(64),
                    active BOOLEAN DEFAULT TRUE,
                    created_by_account_id BIGINT,
                    created_at TIMESTAMP
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS document_type_definitions (
                    id BIGSERIAL PRIMARY KEY,
                    category VARCHAR(64) NOT NULL,
                    category_definition_id BIGINT,
                    name VARCHAR(160) NOT NULL,
                    code VARCHAR(32),
                    office VARCHAR(120),
                    faculty VARCHAR(160),
                    department VARCHAR(160),
                    active BOOLEAN DEFAULT TRUE,
                    created_by_account_id BIGINT,
                    created_at TIMESTAMP
                )
                """);
        jdbcTemplate.execute("ALTER TABLE document_type_definitions ADD COLUMN IF NOT EXISTS category_definition_id BIGINT");
        jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS category_definition_id BIGINT");
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_preferences (
                    account_id BIGINT PRIMARY KEY,
                    preferences_json TEXT,
                    updated_at TIMESTAMP
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS mobile_scan_sessions (
                    token VARCHAR(64) PRIMARY KEY,
                    expires_at TIMESTAMP NOT NULL,
                    ready BOOLEAN DEFAULT FALSE,
                    pdf_bytes BYTEA
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS mobile_scan_pages (
                    id BIGSERIAL PRIMARY KEY,
                    session_token VARCHAR(64) NOT NULL,
                    page_id VARCHAR(64) NOT NULL,
                    page_order INTEGER NOT NULL,
                    image_bytes BYTEA NOT NULL
                )
                """);

        seedCategory("Registration Forms", "REGISTRATION_FORM", "Registrar Office");
        seedCategory("Reintegration Forms", "REINTEGRATION_FORM", "Registrar Office");
        seedCategory("Application Documents", "APPLICATION_DOCUMENTS", "Registrar Office");
        seedCategory("Examination Documents", "EXAMINATION_DOCUMENTS", "Examination Office");
        seedCategory("Final Year Project", "FINAL_YEAR_PROJECT", "University Library");

        seedDocumentType("REGISTRATION_FORM", "Registration Form", "Registrar Office");
        seedDocumentType("REINTEGRATION_FORM", "Reintegration Form", "Registrar Office");
        seedDocumentType("APPLICATION_DOCUMENTS", "Application Form", "Registrar Office");
        seedDocumentType("APPLICATION_DOCUMENTS", "Birth Certificate", "Registrar Office");
        seedDocumentType("EXAMINATION_DOCUMENTS", "Exam Paper", "Examination Office");
        seedDocumentType("FINAL_YEAR_PROJECT", "Final Year Project", "University Library");
        seedSubtype("REGISTRATION_FORM", "Registration Form", null);
        seedSubtype("APPLICATION_DOCUMENTS", "Application Form", null);
        seedSubtype("APPLICATION_DOCUMENTS", "Birth Certificate", null);
        seedSubtype("APPLICATION_DOCUMENTS", "Recommendation Letter", null);
    }

    private void seedCategory(String name, String legacyCategory, String office) {
        Integer count = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*) FROM document_category_definitions
                        WHERE LOWER(name) = LOWER(?) AND office = ?
                        """,
                Integer.class,
                name,
                office
        );
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.update(
                """
                        INSERT INTO document_category_definitions (name, code, office, legacy_category, active, created_at)
                        VALUES (?, ?, ?, ?, TRUE, NOW())
                        """,
                name,
                slugCode(name),
                office,
                legacyCategory
        );
    }

    private Long resolveCategoryId(String legacyCategory, String office) {
        return jdbcTemplate.query(
                """
                        SELECT id FROM document_category_definitions
                        WHERE legacy_category = ? AND office = ?
                        ORDER BY id ASC
                        LIMIT 1
                        """,
                rs -> rs.next() ? rs.getLong("id") : null,
                legacyCategory,
                office
        );
    }

    private void seedDocumentType(String category, String name, String office) {
        Integer count = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*) FROM document_type_definitions
                        WHERE category = ? AND LOWER(name) = LOWER(?) AND office = ?
                        """,
                Integer.class,
                category,
                name,
                office
        );
        if (count != null && count > 0) {
            Long categoryId = resolveCategoryId(category, office);
            if (categoryId != null) {
                jdbcTemplate.update(
                        """
                                UPDATE document_type_definitions
                                SET category_definition_id = ?
                                WHERE category = ? AND LOWER(name) = LOWER(?) AND office = ?
                                  AND category_definition_id IS NULL
                                """,
                        categoryId,
                        category,
                        name,
                        office
                );
            }
            return;
        }
        Long categoryId = resolveCategoryId(category, office);
        jdbcTemplate.update(
                """
                        INSERT INTO document_type_definitions (category, category_definition_id, name, code, office, active, created_at)
                        VALUES (?, ?, ?, ?, ?, TRUE, NOW())
                        """,
                category,
                categoryId,
                name,
                slugCode(name),
                office
        );
    }

    private void seedSubtype(String category, String name, String department) {
        Integer count = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*) FROM document_subtypes
                        WHERE category = ? AND LOWER(name) = LOWER(?) AND COALESCE(department, '') = COALESCE(?, '')
                        """,
                Integer.class,
                category,
                name,
                department
        );
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.update(
                """
                        INSERT INTO document_subtypes (category, name, code, department, active, created_by, created_at)
                        VALUES (?, ?, ?, ?, TRUE, 'system', NOW())
                        """,
                category,
                name,
                slugCode(name),
                department
        );
    }

    private String slugCode(String name) {
        return name.toUpperCase().replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
    }
}
