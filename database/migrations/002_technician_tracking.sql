-- Jalankan satu kali pada database Billing yang sudah ada untuk mengaktifkan lokasi teknisi.
-- Instalasi baru yang mengimpor schema_lifemedia.sql tidak perlu menjalankan migrasi ini.

CREATE TABLE IF NOT EXISTS `technician_locations` (
  `technician_id` INT PRIMARY KEY,
  `latitude` DECIMAL(10,7) NOT NULL,
  `longitude` DECIMAL(10,7) NOT NULL,
  `accuracy_m` DECIMAL(8,2) NULL,
  `recorded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_technician_location_technician` FOREIGN KEY (`technician_id`) REFERENCES `technicians` (`id`) ON DELETE CASCADE,
  INDEX `idx_technician_location_recorded` (`recorded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
