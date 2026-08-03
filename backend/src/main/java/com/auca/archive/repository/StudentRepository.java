package com.auca.archive.repository;

import com.auca.archive.model.StudentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StudentRepository extends JpaRepository<StudentEntity, Long> {
    Optional<StudentEntity> findByStudentNumber(String studentNumber);

    boolean existsByStudentNumber(String studentNumber);

    List<StudentEntity> findByStudentNumberContainingIgnoreCaseOrFullNameContainingIgnoreCase(String studentNumber, String fullName);
}
