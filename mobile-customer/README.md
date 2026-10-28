# Life Media Pelanggan

Aplikasi Expo terpisah untuk akun Pelanggan. Aplikasi memakai API utama pada `server/` yang sama dengan web admin.

1. Salin `.env.example` ke `.env`.
2. Isi `EXPO_PUBLIC_API_URL` dengan URL API yang bisa dijangkau perangkat. Pada Android Emulator, `http://10.0.2.2:5000/api` mengarah ke komputer host. Pada ponsel fisik, gunakan IP LAN komputer dan pastikan firewall mengizinkan port API.
3. Jalankan `npm install`, `npx expo install --fix`, lalu `npx expo start`.

Fitur: login pelanggan, tagihan dan jatuh tempo, pembayaran Midtrans/manual, upload bukti, riwayat pembayaran, complain bergambar, timeline, kontak teknisi yang ditugaskan, dan inbox notifikasi.
