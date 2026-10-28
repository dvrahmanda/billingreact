-- Jalankan satu kali pada database Billing yang sudah ada sebelum memakai build ini.
-- Instalasi baru yang mengimpor schema_lifemedia.sql tidak perlu menjalankan migrasi ini.

ALTER TABLE pelanggan_salam ADD COLUMN alamat_lengkap VARCHAR(500) NULL AFTER alamat;
ALTER TABLE payments ADD COLUMN snap_token TEXT NULL AFTER midtrans_status_response;
ALTER TABLE payments ADD UNIQUE KEY uk_midtrans_transaction (midtrans_transaction_id);
ALTER TABLE complaints ADD COLUMN penyebab_gangguan TEXT NULL AFTER catatan_teknisi;
ALTER TABLE complaints ADD COLUMN tindakan_penanganan TEXT NULL AFTER penyebab_gangguan;
ALTER TABLE complaints ADD COLUMN hasil_penanganan TEXT NULL AFTER tindakan_penanganan;
ALTER TABLE complaints ADD COLUMN alasan_penolakan TEXT NULL AFTER hasil_penanganan;

CREATE TABLE IF NOT EXISTS user_notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  wilayah VARCHAR(60) NULL,
  jenis VARCHAR(40) NOT NULL,
  judul VARCHAR(180) NOT NULL,
  pesan TEXT NOT NULL,
  tautan VARCHAR(255) NULL,
  dibaca_pada DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user_unread (user_id,dibaca_pada,created_at),
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_delivery_keys (
  dedupe_key VARCHAR(190) PRIMARY KEY,
  status ENUM('attempted','terkirim','gagal') NOT NULL DEFAULT 'attempted',
  response_gateway TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
