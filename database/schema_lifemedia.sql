-- =========================================================================
-- DATABASE BILLING LIFE MEDIA - DAERAH SALAM
-- PT SARANA INSAN MUDA SELARAS
-- =========================================================================

CREATE DATABASE IF NOT EXISTS `billing_lifemedia` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `billing_lifemedia`;

-- 1. TABEL PENGGUNA SISTEM (USERS)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(60) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('superadmin', 'admin', 'teknisi', 'pelanggan') NOT NULL DEFAULT 'admin',
  `wilayah` VARCHAR(60) NOT NULL DEFAULT 'SEMUA',
  `nama_lengkap` VARCHAR(120) NULL,
  `nomor_telepon` VARCHAR(30) NULL,
  `status` ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role_wilayah` (`role`, `wilayah`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. TABEL PELANGGAN (MASTER PELANGGAN & PERIODE BERJALAN)
CREATE TABLE IF NOT EXISTS `pelanggan_salam` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `id_pelanggan` VARCHAR(60) NOT NULL UNIQUE,
  `kode_pelanggan` VARCHAR(60) NULL,
  `nama` VARCHAR(150) NOT NULL,
  `nomor_pelanggan` VARCHAR(30) NULL,
  `alamat` VARCHAR(100) NOT NULL,
  `alamat_lengkap` VARCHAR(500) NULL,
  `paket` VARCHAR(100) NOT NULL,
  `tarif_langganan` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tagihan` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status_bayar` ENUM('Lunas', 'Belum Lunas') NOT NULL DEFAULT 'Belum Lunas',
  `status_pelanggan` ENUM('Aktif', 'Tidak Aktif') NOT NULL DEFAULT 'Aktif',
  `waktu` DATE NOT NULL,
  `langganan_selesai` DATE NOT NULL,
  `tanggal_daftar` DATE DEFAULT (CURRENT_DATE),
  `tanggal_bayar` DATETIME NULL,
  `nominal_dibayar` DECIMAL(12,2) NULL,
  `nomor_invoice` VARCHAR(80) NULL,
  `user_id` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_pelanggan_wilayah` (`alamat`),
  INDEX `idx_pelanggan_status_bayar` (`status_bayar`),
  INDEX `idx_pelanggan_status_aktif` (`status_pelanggan`),
  INDEX `idx_pelanggan_waktu` (`waktu`),
  CONSTRAINT `fk_pelanggan_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TABEL DETAIL PROFIL & KOORDINAT PELANGGAN
CREATE TABLE IF NOT EXISTS `pelanggan_detail_salam` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `pelanggan_id` INT NOT NULL UNIQUE,
  `nama_ktp` VARCHAR(150) NULL,
  `nik` VARCHAR(40) NULL,
  `foto_rumah` VARCHAR(255) NULL,
  `koordinat_x` DECIMAL(11,8) NULL,
  `koordinat_y` DECIMAL(10,8) NULL,
  `pppoe_user` VARCHAR(100) NULL,
  `catatan` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_detail_pppoe_user` (`pppoe_user`),
  CONSTRAINT `fk_detail_pelanggan` FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan_salam` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. TABEL RIWAYAT TAGIHAN BULANAN (ARCHIVE)
CREATE TABLE IF NOT EXISTS `tagihan_salam` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `pelanggan_id` INT NOT NULL,
  `periode` DATE NOT NULL,
  `id_pelanggan_snapshot` VARCHAR(60) NOT NULL,
  `nama_snapshot` VARCHAR(150) NOT NULL,
  `alamat_snapshot` VARCHAR(100) NOT NULL,
  `paket_snapshot` VARCHAR(100) NOT NULL,
  `tarif_snapshot` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `nominal_tagihan` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status_bayar` ENUM('Lunas', 'Belum Lunas') NOT NULL DEFAULT 'Belum Lunas',
  `tanggal_jatuh_tempo` DATE NOT NULL,
  `tanggal_bayar` DATETIME NULL,
  `nominal_dibayar` DECIMAL(12,2) NULL,
  `nomor_invoice` VARCHAR(80) NULL,
  `metode_pembayaran` VARCHAR(50) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_pelanggan_periode` (`pelanggan_id`, `periode`),
  INDEX `idx_tagihan_alamat_periode` (`alamat_snapshot`, `periode`),
  INDEX `idx_tagihan_status` (`status_bayar`),
  CONSTRAINT `fk_tagihan_pelanggan` FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan_salam` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. TABEL PENGATURAN PEMBAYARAN PER WILAYAH
CREATE TABLE IF NOT EXISTS `wilayah_configs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `wilayah` VARCHAR(60) NOT NULL UNIQUE,
  `nama_layanan` VARCHAR(150) NOT NULL,
  `nomor_whatsapp` VARCHAR(30) NULL,
  `catatan_pembayaran` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. TABEL METODE PEMBAYARAN WILAYAH
CREATE TABLE IF NOT EXISTS `wilayah_payment_methods` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `wilayah_config_id` INT NOT NULL,
  `jenis` ENUM('bank', 'ewallet') NOT NULL DEFAULT 'bank',
  `nama` VARCHAR(80) NOT NULL,
  `nomor` VARCHAR(80) NOT NULL,
  `atas_nama` VARCHAR(120) NOT NULL,
  INDEX `idx_wpm_config` (`wilayah_config_id`),
  CONSTRAINT `fk_wpm_config` FOREIGN KEY (`wilayah_config_id`) REFERENCES `wilayah_configs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. TABEL TRANSAKSI PEMBAYARAN (MIDTRANS & MANUAL)
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` VARCHAR(100) NOT NULL UNIQUE,
  `pelanggan_id` INT NOT NULL,
  `tagihan_id` INT NULL,
  `periode` DATE NOT NULL,
  `tipe_pembayaran` ENUM('midtrans', 'manual') NOT NULL,
  `metode` VARCHAR(60) NULL,
  `nominal_tagihan` DECIMAL(12,2) NOT NULL,
  `nominal_dibayar` DECIMAL(12,2) NOT NULL,
  `status` ENUM('pending', 'menunggu_verifikasi', 'lunas', 'ditolak', 'expired', 'gagal') NOT NULL DEFAULT 'pending',
  `bukti_transfer` VARCHAR(255) NULL,
  `catatan_admin` TEXT NULL,
  `verified_by` INT NULL,
  `verified_at` DATETIME NULL,
  `midtrans_transaction_id` VARCHAR(120) NULL,
  `midtrans_status_response` JSON NULL,
  `snap_token` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_payments_order` (`order_id`),
  INDEX `idx_payments_status` (`status`),
  INDEX `idx_payments_pelanggan` (`pelanggan_id`),
  UNIQUE KEY `uk_midtrans_transaction` (`midtrans_transaction_id`),
  CONSTRAINT `fk_payment_pelanggan` FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan_salam` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payment_verifier` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. TABEL TEKNISI
CREATE TABLE IF NOT EXISTS `technicians` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL UNIQUE,
  `nama` VARCHAR(120) NOT NULL,
  `nomor_whatsapp` VARCHAR(30) NOT NULL,
  `wilayah_tugas` VARCHAR(60) NOT NULL DEFAULT 'SALAM',
  `status` ENUM('tersedia', 'bertugas', 'off') NOT NULL DEFAULT 'tersedia',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_tech_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. TABEL COMPLAIN GANGGUAN PELANGGAN
CREATE TABLE IF NOT EXISTS `complaints` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nomor_tiket` VARCHAR(60) NOT NULL UNIQUE,
  `pelanggan_id` INT NOT NULL,
  `kategori` ENUM('internet_mati', 'internet_lambat', 'perangkat', 'kabel_putus', 'lainnya') NOT NULL,
  `deskripsi` TEXT NOT NULL,
  `foto_kendala` VARCHAR(255) NULL,
  `status` ENUM(
    'menunggu_verifikasi',
    'terverifikasi',
    'ditugaskan',
    'menuju_lokasi',
    'dalam_penanganan',
    'menunggu_material',
    'penanganan_selesai',
    'closed',
    'ditolak'
  ) NOT NULL DEFAULT 'menunggu_verifikasi',
  `teknisi_id` INT NULL,
  `pppoe_user_snapshot` VARCHAR(100) NULL,
  `catatan_teknisi` TEXT NULL,
  `penyebab_gangguan` TEXT NULL,
  `tindakan_penanganan` TEXT NULL,
  `hasil_penanganan` TEXT NULL,
  `alasan_penolakan` TEXT NULL,
  `foto_hasil_penanganan` VARCHAR(255) NULL,
  `diverifikasi_oleh` INT NULL,
  `diverifikasi_pada` DATETIME NULL,
  `ditutup_oleh` INT NULL,
  `ditutup_pada` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_complaints_status` (`status`),
  INDEX `idx_complaints_pelanggan` (`pelanggan_id`),
  INDEX `idx_complaints_teknisi` (`teknisi_id`),
  CONSTRAINT `fk_complaint_pelanggan` FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan_salam` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_complaint_teknisi` FOREIGN KEY (`teknisi_id`) REFERENCES `technicians` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_complaint_verifier` FOREIGN KEY (`diverifikasi_oleh`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_complaint_closer` FOREIGN KEY (`ditutup_oleh`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. TABEL TIMELINE COMPLAIN
CREATE TABLE IF NOT EXISTS `complaint_timelines` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `complaint_id` INT NOT NULL,
  `status` VARCHAR(60) NOT NULL,
  `judul` VARCHAR(150) NOT NULL,
  `keterangan` TEXT NULL,
  `aktor_id` INT NULL,
  `aktor_nama` VARCHAR(100) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_timeline_complaint` (`complaint_id`),
  CONSTRAINT `fk_timeline_complaint` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. TABEL LOG NOTIFIKASI WHATSAPP
CREATE TABLE IF NOT EXISTS `message_send_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `wilayah` VARCHAR(60) NOT NULL,
  `id_pelanggan` VARCHAR(60) NULL,
  `target_nomor` VARCHAR(30) NULL,
  `message_type` VARCHAR(60) NOT NULL,
  `pesan` TEXT NULL,
  `status` ENUM('terkirim', 'gagal') NOT NULL DEFAULT 'terkirim',
  `response_gateway` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_msl_wilayah_date` (`wilayah`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. TABEL AUDIT / ACTIVITY LOG
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `username` VARCHAR(60) NOT NULL,
  `role` VARCHAR(30) NOT NULL,
  `wilayah` VARCHAR(60) NULL,
  `aksi` VARCHAR(100) NOT NULL,
  `entitas` VARCHAR(60) NOT NULL,
  `entitas_id` VARCHAR(60) NULL,
  `rincian` TEXT NULL,
  `ip_address` VARCHAR(50) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. NOTIFIKASI WEB/MOBILE PER PENGGUNA
CREATE TABLE IF NOT EXISTS `user_notifications` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `wilayah` VARCHAR(60) NULL,
  `jenis` VARCHAR(40) NOT NULL,
  `judul` VARCHAR(180) NOT NULL,
  `pesan` TEXT NOT NULL,
  `tautan` VARCHAR(255) NULL,
  `dibaca_pada` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_notifications_user_unread` (`user_id`,`dibaca_pada`,`created_at`),
  CONSTRAINT `fk_notification_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kunci deduplikasi terpisah menjaga agar percobaan notifikasi yang sama tidak terkirim berulang.
CREATE TABLE IF NOT EXISTS `notification_delivery_keys` (
  `dedupe_key` VARCHAR(190) PRIMARY KEY,
  `status` ENUM('attempted','terkirim','gagal') NOT NULL DEFAULT 'attempted',
  `response_gateway` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================================
-- SEED DATA AWAL (DEFAULT ACCOUNTS & CONFIGS)
-- Password default: 's0t0kudus' (hash bcrypt)
-- =========================================================================

INSERT INTO `users` (`username`, `password`, `role`, `wilayah`, `nama_lengkap`, `nomor_telepon`) VALUES
('superadmin', '$2y$10$vY35K197kH3qIkgbJ1V20e85mN6H44U6qXFp14T11N53f22lZ4C1e', 'superadmin', 'SEMUA', 'Super Admin Life Media', '6287839817566'),
('admin_baran', '$2y$10$vY35K197kH3qIkgbJ1V20e85mN6H44U6qXFp14T11N53f22lZ4C1e', 'admin', 'BARAN', 'Admin Wilayah Baran', '6282338635691'),
('admin_gunungmanuk', '$2y$10$vY35K197kH3qIkgbJ1V20e85mN6H44U6qXFp14T11N53f22lZ4C1e', 'admin', 'GUNUNGMANUK', 'Admin Wilayah Gunungmanuk', '6282338635691'),
('admin_ngasemayu', '$2y$10$vY35K197kH3qIkgbJ1V20e85mN6H44U6qXFp14T11N53f22lZ4C1e', 'admin', 'NGASEMAYU', 'Admin Wilayah Ngasemayu', '6282338635691'),
('admin_salam', '$2y$10$vY35K197kH3qIkgbJ1V20e85mN6H44U6qXFp14T11N53f22lZ4C1e', 'admin', 'SALAM', 'Admin Wilayah Salam', '6287839817566'),
('admin_trosari', '$2y$10$vY35K197kH3qIkgbJ1V20e85mN6H44U6qXFp14T11N53f22lZ4C1e', 'admin', 'TROSARI', 'Admin Wilayah Trosari', '6282338635691'),
('admin_waduk', '$2y$10$vY35K197kH3qIkgbJ1V20e85mN6H44U6qXFp14T11N53f22lZ4C1e', 'admin', 'WADUK', 'Admin Wilayah Waduk', '6282338635691')
ON DUPLICATE KEY UPDATE `username` = VALUES(`username`);

-- Konfigurasi Wilayah
INSERT INTO `wilayah_configs` (`wilayah`, `nama_layanan`, `nomor_whatsapp`, `catatan_pembayaran`) VALUES
('BARAN', 'Billing BARAN / Life Media', '6282338635691', 'Konfirmasi pembayaran ke Admin Wilayah Baran.'),
('GUNUNGMANUK', 'Billing GUNUNGMANUK / Life Media', '6282338635691', 'Konfirmasi pembayaran ke Admin Wilayah Gunungmanuk.'),
('NGASEMAYU', 'Billing NGASEMAYU / Life Media', '6282338635691', 'Konfirmasi pembayaran ke Admin Wilayah Ngasemayu.'),
('SALAM', 'Billing SALAM / Life Media', '6287839817566', 'Konfirmasi pembayaran ke Admin Wilayah Salam.'),
('TROSARI', 'Billing TROSARI / Life Media', '6282338635691', 'Konfirmasi pembayaran ke Admin Wilayah Trosari.'),
('WADUK', 'Billing WADUK / Life Media', '6282338635691', 'Konfirmasi pembayaran ke Admin Wilayah Waduk.')
ON DUPLICATE KEY UPDATE `nama_layanan` = VALUES(`nama_layanan`);

-- Rekening Default Salam (BCA)
INSERT INTO `wilayah_payment_methods` (`wilayah_config_id`, `jenis`, `nama`, `nomor`, `atas_nama`) 
SELECT id, 'bank', 'BCA', '8950258552', 'Witono' FROM `wilayah_configs` WHERE `wilayah` = 'SALAM';

-- Teknisi Default
INSERT INTO `technicians` (`nama`, `nomor_whatsapp`, `wilayah_tugas`, `status`) VALUES
('Bambang Irawan', '6281234567891', 'SALAM', 'tersedia'),
('Ahmad Fauzi', '6281234567892', 'BARAN', 'tersedia');
