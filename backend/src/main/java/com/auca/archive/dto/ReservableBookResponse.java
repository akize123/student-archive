package com.auca.archive.dto;

public record ReservableBookResponse(
        Long id,
        String title,
        String studentNumber,
        String ownerName,
        String department
) {
}
