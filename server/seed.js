require('dotenv').config();const bcrypt=require('bcryptjs');const db=require('./config/database');
(async()=>{try{const hash=await bcrypt.hash('admin123',10);const rows=[
 ['superadmin',hash,'superadmin','SEMUA','Super Admin Life Media'],
 ['admin_baran',hash,'admin','BARAN','Admin Wilayah Baran'],['admin_gunungmanuk',hash,'admin','GUNUNGMANUK','Admin Wilayah Gunungmanuk'],
 ['admin_ngasemayu',hash,'admin','NGASEMAYU','Admin Wilayah Ngasemayu'],['admin_salam',hash,'admin','SALAM','Admin Wilayah Salam'],
 ['admin_trosari',hash,'admin','TROSARI','Admin Wilayah Trosari'],['admin_waduk',hash,'admin','WADUK','Admin Wilayah Waduk']];
 for(const r of rows)await db.query(`INSERT INTO users(username,password,role,wilayah,nama_lengkap,status) VALUES (?,?,?,?,?,'aktif') ON DUPLICATE KEY UPDATE password=VALUES(password),role=VALUES(role),wilayah=VALUES(wilayah),nama_lengkap=VALUES(nama_lengkap),status='aktif'`,r);
 console.log('Seeder selesai. Password seluruh akun seed: admin123');process.exit(0)}catch(e){console.error(e);process.exit(1)}})();
