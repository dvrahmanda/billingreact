# Billing Internet Life Media — ReactJS + Node.js/Express

Project ini disusun dari hasil keluaran AI Studio yang sebelumnya masih berupa potongan kode, struktur folder, SQL, dan beberapa komponen. Versi ini sudah dibentuk menjadi project yang bisa dijalankan.

## Stack

- Web Admin: ReactJS + Vite + CSS
- Backend/API: Node.js + Express
- Database: MySQL
- Auth: JWT
- Integrasi backend: Midtrans, WhatsApp API, PPPoE
- Web tersedia untuk Super Admin, Admin Wilayah, dan Relawan
- Pelanggan & Teknisi memakai dua aplikasi Expo terpisah dan backend yang sama

## Mode Demo

Secara default `.env.example` menggunakan `DEMO_MODE=true`. Mode ini membuat project bisa langsung dicoba tanpa MySQL.

Akun demo:
- Super Admin: `superadmin` / `admin123`
- Admin Wilayah Salam: `adminwilayahsalam` / `admin123`
- Relawan Baran: `adminbaran` / `admin123`
- Relawan Gunungmanuk: `admingunungmanuk` / `admin123`
- Relawan Ngasemayu: `adminngasemayu` / `admin123`
- Relawan Salam: `adminsalam` / `admin123`
- Relawan Trosari: `admintrosari` / `admin123`
- Relawan Waduk: `adminwaduk` / `admin123`
- Pelanggan: `pelanggan_ayu` / `pelanggan123`
- Teknisi: `teknisi_bambang` / `teknisi123`

## Menjalankan

### 1. Backend

```bash
cd server
copy .env.example .env
npm install
npm run dev
```

Backend: `http://localhost:5000`

### 2. Frontend

Buka terminal kedua:

```bash
cd client
copy .env.example .env
npm install
npm run dev
```

Frontend: `http://localhost:5173`

### 3. Aplikasi Mobile

Jalankan `npm install` di `mobile-customer` dan `mobile-technician`, lalu salin `.env.example` menjadi `.env` pada masing-masing aplikasi. Atur `EXPO_PUBLIC_API_URL` ke alamat backend yang dapat dijangkau dari perangkat. Untuk emulator Android, `10.0.2.2` mengarah ke host; untuk ponsel fisik gunakan alamat LAN komputer.

```bash
cd mobile-customer
npm install
npx expo start
```

Ulangi pada `mobile-technician`. Alternatifnya jalankan `npm run install:all` di root, lalu `npm run mobile:customer` atau `npm run mobile:technician`.

## Menggunakan MySQL

1. Import `database/schema_lifemedia.sql`.
   Untuk database lama, jalankan `database/migrations/003_relawan_role.sql`, lalu `database/migrations/004_admin_wilayah_relawan.sql` satu kali. Migrasi ini mempertahankan password akun lokal yang sudah ada.
2. Ubah `server/.env`:
   - `DEMO_MODE=false`
   - sesuaikan `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
3. Restart backend.

Untuk database development kosong, `npm run seed` membuat akun demo dengan password `admin123`. Seeder mengatur ulang password akun seed, jadi jangan jalankan pada database operasional.

Sistem memiliki satu Admin Wilayah Salam (`adminwilayahsalam`) yang mengelola seluruh wilayah dan akun Relawan. Setiap Relawan terikat pada satu wilayah dan hanya mendapat akses penagihan: dashboard, data pelanggan dasar, daftar tagihan, serta riwayat pembayaran. Relawan tidak dapat membuka laporan, complain/teknisi, atau PPPoE.

## Catatan Fitur

Project web mencakup:
- Dashboard Super Admin / Admin Wilayah / Relawan
- Data pelanggan
- Tagihan dan riwayat
- Pembayaran & verifikasi manual
- Pengecekan/pencocokan pembayaran
- Monitoring & mapping PPPoE
- Complain dan penugasan teknisi
- Monitoring teknisi
- Laporan
- Analitik
- Manajemen Relawan Wilayah
- Activity overview

Aplikasi Pelanggan mencakup login, ringkasan tagihan, riwayat pembayaran, pembayaran Midtrans/manual, upload bukti, complain bergambar, timeline, dan notifikasi. Aplikasi Teknisi mencakup daftar/detail tugas, lokasi dan kontak pelanggan, data PPPoE, foto gangguan, update progres, catatan, bukti penanganan, dan notifikasi.

Mode demo tidak menghubungi layanan luar. Integrasi Midtrans, WhatsApp gateway, dan monitoring PPPoE membutuhkan credential serta endpoint perusahaan. Notifikasi mobile saat ini berupa pusat notifikasi dalam aplikasi; push notification native memerlukan konfigurasi provider dan kredensial aplikasi.
