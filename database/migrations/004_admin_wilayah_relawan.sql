-- Jalankan setelah 003_relawan_role.sql pada database yang sudah terpakai.
-- Admin lokal yang sudah ada menjadi Relawan. Buat satu Admin Wilayah Salam.

UPDATE `users`
SET `role` = 'relawan',
    `nama_lengkap` = CASE UPPER(TRIM(`wilayah`))
      WHEN 'BARAN' THEN 'Relawan Baran'
      WHEN 'GUNUNGMANUK' THEN 'Relawan Gunungmanuk'
      WHEN 'NGASEMAYU' THEN 'Relawan Ngasemayu'
      WHEN 'SALAM' THEN 'Relawan Salam'
      WHEN 'TROSARI' THEN 'Relawan Trosari'
      WHEN 'WADUK' THEN 'Relawan Waduk'
      ELSE `nama_lengkap`
    END
WHERE `role` = 'admin'
  AND `username` <> 'adminwilayahsalam'
  AND UPPER(TRIM(`wilayah`)) IN ('BARAN','GUNUNGMANUK','NGASEMAYU','SALAM','TROSARI','WADUK');

UPDATE `users`
SET `username` = CASE `username`
  WHEN 'admin_baran' THEN 'adminbaran'
  WHEN 'admin_gunungmanuk' THEN 'admingunungmanuk'
  WHEN 'admin_ngasemayu' THEN 'adminngasemayu'
  WHEN 'admin_salam' THEN 'adminsalam'
  WHEN 'admin_trosari' THEN 'admintrosari'
  WHEN 'admin_waduk' THEN 'adminwaduk'
  ELSE `username`
END
WHERE `username` IN ('admin_baran','admin_gunungmanuk','admin_ngasemayu','admin_salam','admin_trosari','admin_waduk');

UPDATE `users`
SET `role` = 'admin', `wilayah` = 'SALAM', `nama_lengkap` = 'Admin Wilayah Salam'
WHERE `username` = 'adminwilayahsalam';

INSERT INTO `users` (`username`, `password`, `role`, `wilayah`, `nama_lengkap`, `nomor_telepon`, `status`)
SELECT 'adminwilayahsalam', '$2y$10$vY35K197kH3qIkgbJ1V20e85mN6H44U6qXFp14T11N53f22lZ4C1e', 'admin', 'SALAM', 'Admin Wilayah Salam', '6287839817566', 'aktif'
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `username` = 'adminwilayahsalam');
