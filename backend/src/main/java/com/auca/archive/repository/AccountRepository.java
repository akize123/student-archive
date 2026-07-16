package com.auca.archive.repository;

import com.auca.archive.model.AccountEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AccountRepository extends JpaRepository<AccountEntity, Long> {
    Optional<AccountEntity> findByUsername(String username);

    Optional<AccountEntity> findByStudentNumberIgnoreCase(String studentNumber);
}
