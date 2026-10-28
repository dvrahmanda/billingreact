# Status Implementasi

## Sudah disusun dan terhubung
- Struktur ReactJS + Vite
- Struktur Node.js + Express REST API
- Login JWT untuk Super Admin, Admin Wilayah, Pelanggan, dan Teknisi
- Pembatasan wilayah pada backend untuk modul utama
- Dashboard role-based
- Pelanggan: list, search, filter, pagination, detail, tambah/edit/nonaktif, import preview/konfirmasi, export Excel, foto privat, akun mobile
- Tagihan: histori per periode, generate idempoten, dashboard, filter, export Excel, detail/invoice cetak
- Pembayaran: riwayat, upload manual, verifikasi/penolakan beralasan, webhook Midtrans, pengecekan pembayaran
- PPPoE: monitoring read-only, unmatched, manual mapping
- Complain: create dari mobile, foto, verifikasi, penolakan beralasan, assign, timeline, progres teknisi, verifikasi hasil, close
- Teknisi: akun mobile, daftar/detail tugas pribadi, koordinat, PPPoE, status bertahap, catatan/foto hasil
- Aplikasi Mobile Pelanggan dan Teknisi terpisah
- Bundle Android kedua aplikasi berhasil diekspor dengan Expo SDK 57
- Laporan keuangan dengan filter, Excel, dan cetak ke PDF
- Analitik visual
- Manajemen Admin Wilayah
- Activity log
- Schema MySQL
- Mode demo tanpa MySQL
- Desain palette Life Media dari hasil AI Studio

## Memerlukan credential atau layanan perusahaan
- Midtrans production/sandbox: butuh Server Key & Client Key
- WhatsApp API: butuh endpoint/token gateway yang dipilih
- PPPoE real-time: butuh endpoint monitoring PPPoE milik perusahaan
- PPPoE saat ini untuk monitoring dan mapping; perubahan sesi/akun MikroTik tidak tersedia tanpa API berizin dari perusahaan
- Notifikasi mobile berjalan sebagai inbox in-app; push notification native perlu provider dan kredensial aplikasi

## Catatan implementasi
- Import menerima `.xlsx` dan `.csv`; workbook `.xls` lama perlu disimpan ulang sebagai `.xlsx`.
- PDF laporan dan invoice memakai dialog cetak browser, lalu pengguna memilih Save as PDF.
- Integrasi Midtrans/WhatsApp/PPPoE belum dapat dibuktikan end-to-end tanpa akun sandbox, gateway, dan endpoint jaringan perusahaan.
- Jalankan migrasi `database/migrations/001_workflow_features.sql` sekali pada database lama; database baru menggunakan schema utama.
- Sebelum produksi, isi credential, gunakan HTTPS, ganti secret dan password seed, lalu validasi transaksi pada sandbox dan hasilkan binary Android/iOS melalui pipeline build perusahaan.
- Audit npm pada dependency mobile melaporkan 3 advisory high dan 5 low pada dependency Expo/CLI; perbaikan otomatis yang ditawarkan npm memerlukan downgrade Expo lintas major, jadi dependency yang kompatibel tidak diubah otomatis.

Project ini dibuat sebagai baseline runnable dari hasil AI Studio yang sebelumnya hanya berupa potongan kode.
