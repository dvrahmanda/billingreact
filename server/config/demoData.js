const today = new Date();
const { currentPeriod, dueDateForPeriod } = require('../utils/dates');
const iso = (offset=0) => { const d=new Date(today); d.setDate(d.getDate()+offset); return d.toISOString(); };
const period = currentPeriod();

const users = [
  {id:1,username:'superadmin',password:'admin123',role:'superadmin',wilayah:'SEMUA',nama_lengkap:'Super Admin Life Media',status:'aktif'},
  {id:2,username:'admin_salam',password:'admin123',role:'admin',wilayah:'SALAM',nama_lengkap:'Admin Wilayah Salam',status:'aktif'},
  {id:3,username:'admin_baran',password:'admin123',role:'admin',wilayah:'BARAN',nama_lengkap:'Admin Wilayah Baran',status:'aktif'},
  {id:20,username:'pelanggan_ayu',password:'pelanggan123',role:'pelanggan',wilayah:'SALAM',nama_lengkap:'Ayu Lestari',status:'aktif',pelanggan_id:1},
  {id:30,username:'teknisi_bambang',password:'teknisi123',role:'teknisi',wilayah:'SALAM',nama_lengkap:'Bambang Irawan',status:'aktif',technician_id:1},
];

const customers = [
 {id:1,id_pelanggan:'SLM-001',kode_pelanggan:'C001',nama:'Ayu Lestari',nama_ktp:'Ayu Lestari',nik:'3506010101010001',nomor_pelanggan:'628123450001',alamat:'SALAM',alamat_lengkap:'SALAM',paket:'20 Mbps',tarif_langganan:175000,tagihan:175000,status_bayar:'Belum Lunas',status_pelanggan:'Aktif',tanggal_daftar:'2025-07-12',koordinat_x:110.3774,koordinat_y:-7.7981,pppoe_user:'salam-ayu',pppoe_status:'ONLINE',pppoe_ip:'10.10.1.21',pppoe_mac:'A4:CF:12:34:56:01',pppoe_router:'RTR-SALAM-01',user_id:20},
 {id:2,id_pelanggan:'SLM-002',kode_pelanggan:'C002',nama:'Bima Pratama',nama_ktp:'Bima Pratama',nik:'3506010101010002',nomor_pelanggan:'628123450002',alamat:'SALAM',paket:'30 Mbps',tarif_langganan:225000,tagihan:225000,status_bayar:'Lunas',status_pelanggan:'Aktif',tanggal_daftar:'2025-09-03',koordinat_x:110.3811,koordinat_y:-7.8015,pppoe_user:'salam-bima',pppoe_status:'OFFLINE',pppoe_ip:'10.10.1.31',pppoe_mac:'A4:CF:12:34:56:02',pppoe_router:'RTR-SALAM-01'},
 {id:3,id_pelanggan:'BRN-001',kode_pelanggan:'C003',nama:'Citra Wulandari',nama_ktp:'Citra Wulandari',nik:'3506010101010003',nomor_pelanggan:'628123450003',alamat:'BARAN',paket:'20 Mbps',tarif_langganan:175000,tagihan:175000,status_bayar:'Belum Lunas',status_pelanggan:'Aktif',tanggal_daftar:'2026-01-19',koordinat_x:110.3901,koordinat_y:-7.7915,pppoe_user:'baran-citra',pppoe_status:'ONLINE',pppoe_ip:'10.20.1.10',pppoe_mac:'A4:CF:12:34:56:03',pppoe_router:'RTR-BARAN-01'},
 {id:4,id_pelanggan:'GNM-001',kode_pelanggan:'C004',nama:'Dimas Nugroho',nama_ktp:'Dimas Nugroho',nik:'3506010101010004',nomor_pelanggan:'628123450004',alamat:'GUNUNGMANUK',paket:'50 Mbps',tarif_langganan:300000,tagihan:300000,status_bayar:'Belum Lunas',status_pelanggan:'Aktif',tanggal_daftar:'2025-11-05',koordinat_x:110.4012,koordinat_y:-7.8055,pppoe_user:'gunung-dimas',pppoe_status:'OFFLINE',pppoe_ip:'10.30.1.8',pppoe_mac:'A4:CF:12:34:56:04',pppoe_router:'RTR-GNM-01'},
 {id:5,id_pelanggan:'NGA-001',kode_pelanggan:'C005',nama:'Eka Rahma',nama_ktp:'Eka Rahma',nik:'3506010101010005',nomor_pelanggan:'628123450005',alamat:'NGASEMAYU',paket:'20 Mbps',tarif_langganan:175000,tagihan:175000,status_bayar:'Lunas',status_pelanggan:'Aktif',tanggal_daftar:'2024-12-01',koordinat_x:110.4102,koordinat_y:-7.8122,pppoe_user:'ngasemayu-eka',pppoe_status:'ONLINE',pppoe_ip:'10.40.1.7',pppoe_mac:'A4:CF:12:34:56:05',pppoe_router:'RTR-NGA-01'},
 {id:6,id_pelanggan:'TRS-001',kode_pelanggan:'C006',nama:'Fajar Hidayat',nama_ktp:'Fajar Hidayat',nik:'3506010101010006',nomor_pelanggan:'628123450006',alamat:'TROSARI',paket:'30 Mbps',tarif_langganan:225000,tagihan:225000,status_bayar:'Belum Lunas',status_pelanggan:'Aktif',tanggal_daftar:'2026-02-08',koordinat_x:110.4201,koordinat_y:-7.8201,pppoe_user:'trosari-fajar',pppoe_status:'ONLINE',pppoe_ip:'10.50.1.7',pppoe_mac:'A4:CF:12:34:56:06',pppoe_router:'RTR-TRS-01'},
 {id:7,id_pelanggan:'WDK-001',kode_pelanggan:'C007',nama:'Gina Maharani',nama_ktp:'Gina Maharani',nik:'3506010101010007',nomor_pelanggan:'628123450007',alamat:'WADUK',paket:'20 Mbps',tarif_langganan:175000,tagihan:175000,status_bayar:'Lunas',status_pelanggan:'Tidak Aktif',tanggal_daftar:'2024-08-08',koordinat_x:110.4291,koordinat_y:-7.8291,pppoe_user:'waduk-gina',pppoe_status:'OFFLINE',pppoe_ip:'10.60.1.7',pppoe_mac:'A4:CF:12:34:56:07',pppoe_router:'RTR-WDK-01'}
];

const bills = customers.map((c,i)=>({
 id:i+1,pelanggan_id:c.id,periode:period,id_pelanggan_snapshot:c.id_pelanggan,nama_snapshot:c.nama,alamat_snapshot:c.alamat,paket_snapshot:c.paket,tarif_snapshot:c.tarif_langganan,
 nominal_tagihan:c.tarif_langganan,status_bayar:c.status_bayar,tanggal_jatuh_tempo:dueDateForPeriod(period),
 tanggal_bayar:c.status_bayar==='Lunas'?iso(-8):null,nominal_dibayar:c.status_bayar==='Lunas'?c.tarif_langganan:null,nomor_invoice:`INV-${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}-${String(i+1).padStart(4,'0')}`,metode_pembayaran:c.status_bayar==='Lunas'?'Midtrans':null
}));

const payments = [
 {id:1,order_id:'PAY-202610-001',pelanggan_id:2,tagihan_id:2,periode:period,tipe_pembayaran:'midtrans',metode:'QRIS',nominal_tagihan:225000,nominal_dibayar:225000,status:'lunas',created_at:iso(-8)}
];
const pppoe = [
 {username:'salam-ayu',customer_id:1,customer_name:'Ayu Lestari',wilayah:'SALAM',ip:'10.10.1.21',mac:'A4:CF:12:34:56:01',router:'RTR-SALAM-01',uptime:'3d 04:11:22',status:'ONLINE',latitude:-7.7981,longitude:110.3774},
 {username:'salam-bima',customer_id:2,customer_name:'Bima Pratama',wilayah:'SALAM',ip:'10.10.1.31',mac:'A4:CF:12:34:56:02',router:'RTR-SALAM-01',uptime:'-',status:'OFFLINE',latitude:-7.8015,longitude:110.3811},
 {username:'baran-citra',customer_id:3,customer_name:'Citra Wulandari',wilayah:'BARAN',ip:'10.20.1.10',mac:'A4:CF:12:34:56:03',router:'RTR-BARAN-01',uptime:'1d 10:05:04',status:'ONLINE',latitude:-7.7915,longitude:110.3901},
 {username:'gunung-dimas',customer_id:4,customer_name:'Dimas Nugroho',wilayah:'GUNUNGMANUK',ip:'10.30.1.8',mac:'A4:CF:12:34:56:04',router:'RTR-GNM-01',uptime:'-',status:'OFFLINE',latitude:-7.8055,longitude:110.4012},
 {username:'ngasemayu-eka',customer_id:5,customer_name:'Eka Rahma',wilayah:'NGASEMAYU',ip:'10.40.1.7',mac:'A4:CF:12:34:56:05',router:'RTR-NGA-01',uptime:'6d 08:42:19',status:'ONLINE',latitude:-7.8122,longitude:110.4102},
 {username:'trosari-fajar',customer_id:6,customer_name:'Fajar Hidayat',wilayah:'TROSARI',ip:'10.50.1.7',mac:'A4:CF:12:34:56:06',router:'RTR-TRS-01',uptime:'0d 08:14:03',status:'ONLINE',latitude:-7.8201,longitude:110.4201},
 {username:'unmatched-demo',customer_id:null,customer_name:null,wilayah:'SALAM',ip:'10.10.1.99',mac:'A4:CF:12:34:56:99',router:'RTR-SALAM-01',uptime:'0d 01:02:03',status:'ONLINE'}
];

const technicians = [
 {id:1,nama:'Bambang Irawan',nomor_whatsapp:'6281234567891',wilayah_tugas:'SALAM',status:'bertugas',active_jobs:1,completed_jobs:18,current_customer:'Bima Pratama',user_id:30},
 {id:2,nama:'Ahmad Fauzi',nomor_whatsapp:'6281234567892',wilayah_tugas:'BARAN',status:'tersedia',active_jobs:0,completed_jobs:22,current_customer:null},
 {id:3,nama:'Rizky Ananda',nomor_whatsapp:'6281234567893',wilayah_tugas:'GUNUNGMANUK',status:'tersedia',active_jobs:0,completed_jobs:14,current_customer:null}
];

const complaints = [
 {id:1,nomor_tiket:'CMP-202610-001',pelanggan_id:2,kategori:'internet_mati',deskripsi:'Internet mati sejak pagi, lampu indikator perangkat normal.',status:'dalam_penanganan',teknisi_id:1,pppoe_user_snapshot:'salam-bima',created_at:iso(-1),timeline:[
  {judul:'Complain dibuat',keterangan:'Pelanggan melaporkan internet mati.',aktor_nama:'Bima Pratama',created_at:iso(-1)},
  {judul:'Complain diverifikasi',keterangan:'Gangguan valid dan perlu penanganan teknisi.',aktor_nama:'Admin Wilayah Salam',created_at:iso(-1)},
  {judul:'Teknisi ditugaskan',keterangan:'Bambang Irawan ditugaskan menangani gangguan.',aktor_nama:'Admin Wilayah Salam',created_at:iso(-1)},
  {judul:'Dalam penanganan',keterangan:'Teknisi melakukan pemeriksaan di lokasi.',aktor_nama:'Bambang Irawan',created_at:iso(0)}
 ]},
 {id:2,nomor_tiket:'CMP-202610-002',pelanggan_id:4,kategori:'internet_lambat',deskripsi:'Kecepatan internet menurun terutama pada malam hari.',status:'menunggu_verifikasi',teknisi_id:null,pppoe_user_snapshot:'gunung-dimas',created_at:iso(0),timeline:[{judul:'Complain dibuat',keterangan:'Laporan baru dari pelanggan.',aktor_nama:'Dimas Nugroho',created_at:iso(0)}]},
 {id:3,nomor_tiket:'CMP-202610-003',pelanggan_id:3,kategori:'kabel_putus',deskripsi:'Kabel luar rumah terlihat putus.',status:'penanganan_selesai',teknisi_id:2,pppoe_user_snapshot:'baran-citra',created_at:iso(-2),timeline:[
  {judul:'Complain dibuat',keterangan:'Kabel terindikasi putus.',aktor_nama:'Citra Wulandari',created_at:iso(-2)},
  {judul:'Penanganan selesai',keterangan:'Kabel diganti dan koneksi kembali normal.',aktor_nama:'Ahmad Fauzi',created_at:iso(-1)}
 ]}
];

const activity = [
 {id:1,username:'superadmin',role:'superadmin',wilayah:'SEMUA',aksi:'LOGIN',entitas:'auth',rincian:'Login ke sistem',created_at:iso(0)},
 {id:2,username:'admin_salam',role:'admin',wilayah:'SALAM',aksi:'VERIFIKASI',entitas:'complaint',rincian:'Memverifikasi CMP-202610-001',created_at:iso(-1)},
 {id:3,username:'admin_salam',role:'admin',wilayah:'SALAM',aksi:'ASSIGN',entitas:'technician',rincian:'Menugaskan Bambang Irawan',created_at:iso(-1)}
];

const notifications = [];
const whatsappDedupe = new Set();
const messageLogs = [];

module.exports = { users, customers, bills, payments, pppoe, technicians, complaints, activity, notifications, whatsappDedupe, messageLogs, period };
