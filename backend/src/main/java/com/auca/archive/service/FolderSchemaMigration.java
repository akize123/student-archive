package com.auca.archive.service;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class FolderSchemaMigration implements CommandLineRunner {
    private final JdbcTemplate jdbcTemplate;

    public FolderSchemaMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        jdbcTemplate.execute("ALTER TABLE folders ADD COLUMN IF NOT EXISTS owner_role VARCHAR(32)");
        widenRoleColumn("folders", "owner_role");
        jdbcTemplate.execute("""
                UPDATE folders
                SET owner_role = 'REGISTRAR'
                WHERE owner_role IS NULL
                  AND UPPER(code) LIKE '%-AY-%'
                """);
        jdbcTemplate.execute("""
                UPDATE folders
                SET owner_role = 'REGISTRAR'
                WHERE owner_role IS NULL
                  AND UPPER(code) LIKE '%-SEM-%'
                  AND UPPER(code) NOT LIKE '%-STU-%'
                """);
        jdbcTemplate.execute("""
                UPDATE folders
                SET owner_role = 'LIBRARIAN'
                WHERE UPPER(code) LIKE '%-LIB'
                  AND (owner_role IS NULL OR owner_role = 'REGISTRAR')
                """);
        jdbcTemplate.execute("""
                UPDATE folders
                SET owner_role = 'FINANCE'
                WHERE UPPER(code) LIKE '%-FIN'
                  AND (owner_role IS NULL OR owner_role = 'REGISTRAR')
                """);
        jdbcTemplate.execute("""
                UPDATE folders
                SET owner_role = 'EXAMINATION_OFFICER'
                WHERE UPPER(code) LIKE '%-EXAM'
                  AND (owner_role IS NULL OR owner_role = 'REGISTRAR')
                """);
        jdbcTemplate.execute("""
                UPDATE folders
                SET owner_role = 'HOD'
                WHERE UPPER(code) LIKE '%-HOD'
                  AND (owner_role IS NULL OR owner_role = 'REGISTRAR')
                """);
        widenRoleColumn("folders", "owner_role");
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
                CHECK (%s IS NULL OR %s IN ('ADMIN', 'REGISTRAR', 'FINANCE', 'EXAMINATION_OFFICER', 'HOD', 'DEAN_OF_FACULTY', 'LIBRARIAN', 'STUDENT'))
                """.formatted(table, constraint, column, column));
    }
}
