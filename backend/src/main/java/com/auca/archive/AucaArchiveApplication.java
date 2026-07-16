package com.auca.archive;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AucaArchiveApplication {
    public static void main(String[] args) {
        SpringApplication.run(AucaArchiveApplication.class, args);
    }
}

