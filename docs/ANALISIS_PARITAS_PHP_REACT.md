# Analisis Sistem Billing PHP ke React

## Ringkasan sistem lama

Arsip `billingpppoe-main.zip` berisi sistem billing PHP native berbasis MySQL. Alur utamanya mencakup data pelanggan per wilayah, periode dan status tagihan, riwayat tagihan, pembayaran, pengingat WhatsApp, monitoring PPPoE, laporan keuangan, analitik, serta akun admin wilayah. Data inti disimpan di `users`, `pelanggan_salam`, dan `tagihan_salam`; log pesan tersimpan di `message_send_log`.

## Kecocokan di aplikasi React

| Alur lama | Bagian React | Status |
| --- | --- | --- |
| Dashboard, data pelanggan, tambah/edit, impor dan ekspor | `DashboardPage`, halaman pelanggan, form, dan impor | Sudah tersedia |
| Status tagihan dan histori per periode | `tagihan_salam`, halaman tagihan, proses billing bulanan | Riwayat periode dipertahankan; invoice baru dibuat secara idempoten |
| Data identitas/foto/koordinat/PPPoE pelanggan | Profil pelanggan dan `pelanggan_detail_salam` | Sudah tersedia |
| Konfigurasi nama layanan dan WhatsApp per wilayah | Pengaturan Wilayah Super Admin | Tersambung ke tabel konfigurasi wilayah; pembayaran memakai Midtrans |
| Laporan berdasarkan periode, pembayaran, status, wilayah, dan pencarian; ekspor Excel/PDF | Laporan Keuangan | Filter dan rincian berpaginasi ditambahkan; PDF dicetak dari seluruh hasil terfilter |
| Tren, tunggakan prioritas, pelanggan pembayar terbaik, perbandingan wilayah, peta | Analitik | Ringkasan dan tabel pembanding ditambahkan ke analitik |
| Monitoring PPPoE live tanpa mengubah perangkat jaringan | Monitoring dan mapping PPPoE | Refresh lima detik; auto-match memakai ID, nama/KTP atau koordinat unik dalam radius 30 meter dan wilayah yang sama |
| Hak akses lintas wilayah | Middleware role/scope API | Super Admin dapat lintas wilayah; Admin Wilayah tetap dibatasi backend ke wilayahnya |

Workflow tambahan yang Anda berikan mencakup pembayaran Midtrans saja, komplain, penugasan teknisi, timeline, notifikasi, aktivitas, dan aplikasi pelanggan/teknisi. Fitur tambahan ini menggunakan tabel workflow React yang tidak terdapat pada dump PHP lama.

## Pindah data dari database lama

Jangan arahkan React langsung ke database PHP lama. Dump lama belum mempunyai semua tabel/kolom workflow React. Skrip migrasi menyalin pengguna, pelanggan, tagihan, detail profil yang tersedia, dan log WhatsApp ke database React yang terpisah; sumber lama tidak diubah.

1. Backup database PHP dan folder foto/dokumen lama.
2. Buat database target dengan mengimpor `database/schema_lifemedia.sql`.
3. Di `server/.env`, isi `DB_NAME` dengan target dan `LEGACY_DB_NAME` beserta koneksi database lama. Nama database pada arsip lama tidak konsisten, jadi gunakan nama yang benar di instalasi Anda. Isi `LEGACY_CONFIG_PATH` dengan path `config_wilayah.json` PHP agar nama layanan dan nomor WhatsApp wilayah ikut disalin. Rekening dan instruksi transfer lama tidak digunakan karena pembayaran baru hanya melalui Midtrans.
4. Pastikan `DEMO_MODE=false`, lalu dari folder `server` jalankan `npm run migrate:legacy-php`.
5. Skrip berhenti jika sumber dan target sama, schema target belum lengkap, atau target sudah memiliki pengguna/pelanggan/tagihan. Periksa jumlah hasil migrasi dan login sebelum menjadikan database target sebagai database aktif.
6. Salin file foto lama ke `server/uploads/foto_rumah` dan pastikan path yang tersimpan sesuai. Jangan menghapus folder lama sampai foto diverifikasi.

Skrip tidak menyalin transaksi Midtrans, komplain atau pekerjaan teknisi karena data tersebut tidak ada di dump PHP yang dianalisis. Data Banyuwangi tidak ikut dimigrasikan: aplikasi React hanya memakai BARAN, GUNUNGMANUK, NGASEMAYU, SALAM, TROSARI, dan WADUK. Pengguna yang khusus untuk wilayah di luar daftar itu, pelanggan, tagihannya, log WhatsApp, dan konfigurasi wilayahnya dilewati; jumlah data yang dilewati dilaporkan setelah migrasi. Data tersebut tetap ada di database PHP lama. Untuk enam wilayah yang didukung, status, nominal, tanggal bayar, nomor invoice, log WhatsApp, profil yang kolomnya tersedia, serta tagihan lama disalin. Seeder demo tidak perlu dijalankan setelah migrasi karena akan mengubah akun dan menambahkan akun contoh.

Admin PHP dengan `wilayah=SEMUA` dimigrasikan menjadi role `superadmin`; Admin Wilayah lainnya tetap memiliki wilayah masing-masing. Password hash lama disalin apa adanya, sehingga login langsung bergantung pada format hash yang dipakai instalasi PHP lama.
