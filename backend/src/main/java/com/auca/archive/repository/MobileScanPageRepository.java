package com.auca.archive.repository;

import com.auca.archive.model.MobileScanPageEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MobileScanPageRepository extends JpaRepository<MobileScanPageEntity, Long> {
    List<MobileScanPageEntity> findBySessionTokenOrderByPageOrderAsc(String sessionToken);

    void deleteBySessionToken(String sessionToken);
}
