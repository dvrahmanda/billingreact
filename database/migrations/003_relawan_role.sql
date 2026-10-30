-- Jalankan satu kali pada database Billing yang sudah ada untuk mengaktifkan role Relawan.
-- Instalasi baru yang mengimpor schema_lifemedia.sql tidak perlu menjalankan migrasi ini.

ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('superadmin', 'admin', 'relawan', 'teknisi', 'pelanggan') NOT NULL DEFAULT 'admin';
