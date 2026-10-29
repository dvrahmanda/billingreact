# Life Media Teknisi

Aplikasi Expo terpisah untuk akun Teknisi. Aplikasi memakai API utama pada `server/` yang sama dengan web admin.

1. Salin `.env.example` ke `.env`.
2. Isi `EXPO_PUBLIC_API_URL` dengan URL API yang bisa dijangkau perangkat. Pada Android Emulator, `http://10.0.2.2:5000/api` mengarah ke komputer host. Pada ponsel fisik, gunakan IP LAN komputer dan pastikan firewall mengizinkan port API.
3. Jalankan `npm install`, `npx expo install --fix`, lalu `npx expo start`.

Lokasi dikirim setelah teknisi memberi izin dan masuk ke akun. Berbagi lokasi berhenti saat logout. Izin latar belakang menjaga pembaruan saat aplikasi tidak sedang terbuka; fitur ini memerlukan development build baru setelah konfigurasi native berubah. Expo Go tetap dapat mengirim lokasi selama aplikasi terbuka.

Fitur: login teknisi, berbagi lokasi saat akun aktif, daftar tugas yang ditugaskan kepadanya, detail pelanggan/lokasi/kontak, status PPPoE, foto gangguan, update progres, status menunggu material, catatan penyebab/tindakan/hasil, foto penanganan, timeline, dan inbox notifikasi.
