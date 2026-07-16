package com.auca.archive.dto;

import com.auca.archive.domain.StudentDocumentCategory;
import com.auca.archive.domain.UserRole;

public record ActivityScope(
        UserRole sourceRole,
        UserRole targetRole,
        String academicDepartment,
        StudentDocumentCategory documentCategory,
        String studentNumber,
        Long actorAccountId,
        String actorUsername
) {
    public static ActivityScope empty() {
        return new ActivityScope(null, null, null, null, null, null, null);
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {
        private UserRole sourceRole;
        private UserRole targetRole;
        private String academicDepartment;
        private StudentDocumentCategory documentCategory;
        private String studentNumber;
        private Long actorAccountId;
        private String actorUsername;

        public Builder sourceRole(UserRole sourceRole) {
            this.sourceRole = sourceRole;
            return this;
        }

        public Builder targetRole(UserRole targetRole) {
            this.targetRole = targetRole;
            return this;
        }

        public Builder academicDepartment(String academicDepartment) {
            this.academicDepartment = academicDepartment;
            return this;
        }

        public Builder documentCategory(StudentDocumentCategory documentCategory) {
            this.documentCategory = documentCategory;
            return this;
        }

        public Builder studentNumber(String studentNumber) {
            this.studentNumber = studentNumber;
            return this;
        }

        public Builder actorAccountId(Long actorAccountId) {
            this.actorAccountId = actorAccountId;
            return this;
        }

        public Builder actorUsername(String actorUsername) {
            this.actorUsername = actorUsername;
            return this;
        }

        public ActivityScope build() {
            return new ActivityScope(
                    sourceRole,
                    targetRole,
                    academicDepartment,
                    documentCategory,
                    studentNumber,
                    actorAccountId,
                    actorUsername
            );
        }
    }
}
