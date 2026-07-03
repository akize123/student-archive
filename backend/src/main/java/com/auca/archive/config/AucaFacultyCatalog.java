package com.auca.archive.config;

import java.util.List;

public final class AucaFacultyCatalog {
    private AucaFacultyCatalog() {
    }

    public record FacultyEntry(String name, String code, List<String> departments) {
    }

    public static final List<FacultyEntry> FACULTIES = List.of(
            new FacultyEntry(
                    "Faculty of Business Administration",
                    "FBA",
                    List.of("Accounting", "Management", "Finance", "Information Management")
            ),
            new FacultyEntry(
                    "Faculty of Information Technology",
                    "FIT",
                    List.of("Networking & Communication Systems", "Software Engineering", "Information Management")
            ),
            new FacultyEntry(
                    "Faculty of Education",
                    "FED",
                    List.of("Educational Psychology", "Languages (English / French)", "Religious Studies", "Business Accounting & Computer Science")
            ),
            new FacultyEntry(
                    "Faculty of Health Sciences (Nursing & Midwifery)",
                    "FHS",
                    List.of("Nursing", "Midwifery")
            ),
            new FacultyEntry(
                    "Faculty of Theology",
                    "FTH",
                    List.of("Theology (Pastoral Training)")
            )
    );
}
