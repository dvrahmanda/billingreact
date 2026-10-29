# Database

1. Import `schema_lifemedia.sql` ke MySQL/Laragon.
2. Pastikan database `billing_lifemedia` terbentuk.
3. Ubah `server/.env` menjadi `DEMO_MODE=false`.
4. Isi koneksi DB.
5. Jika database dibuat dari schema versi sebelumnya, jalankan satu kali `migrations/001_workflow_features.sql`.
6. Jalankan satu kali `migrations/002_technician_tracking.sql` pada database yang sudah ada untuk menambah penyimpanan lokasi teknisi.
7. Untuk database baru pengembangan, dari folder `server` jalankan `npm run seed` agar tersedia akun uji. Jangan jalankan seeder setelah data PHP dimigrasikan.

Database baru cukup mengimpor `schema_lifemedia.sql`; file migrasi hanya untuk database yang sudah ada. Backup database sebelum menjalankan migrasi.

Akun seed memakai password `admin123` untuk pengujian.

## Migrasi dari PHP native

Jangan jalankan `001_workflow_features.sql` pada database PHP lama. Buat database target baru dari `schema_lifemedia.sql`, lalu ikuti [`docs/ANALISIS_PARITAS_PHP_REACT.md`](../docs/ANALISIS_PARITAS_PHP_REACT.md) dan jalankan `npm run migrate:legacy-php` dari folder `server`. Skrip menyalin data inti ke target terpisah dan tidak mengubah database PHP sumber. Untuk menjaga pengaturan dan data lama, gunakan database serta `config_wilayah.json` dari instalasi PHP Anda sendiri.
