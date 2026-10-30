require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/database');

const relawanAccounts = [
  ['admin_baran', 'adminbaran', 'BARAN', 'Relawan Baran'],
  ['admin_gunungmanuk', 'admingunungmanuk', 'GUNUNGMANUK', 'Relawan Gunungmanuk'],
  ['admin_ngasemayu', 'adminngasemayu', 'NGASEMAYU', 'Relawan Ngasemayu'],
  ['admin_salam', 'adminsalam', 'SALAM', 'Relawan Salam'],
  ['admin_trosari', 'admintrosari', 'TROSARI', 'Relawan Trosari'],
  ['admin_waduk', 'adminwaduk', 'WADUK', 'Relawan Waduk'],
];

(async () => {
  try {
    const hash = await bcrypt.hash('admin123', 10);

    for (const [legacyUsername, username, wilayah, nama] of relawanAccounts) {
      const [[legacyUser]] = await db.query("SELECT id FROM users WHERE username=? AND role IN ('admin','relawan') LIMIT 1", [legacyUsername]);
      if (legacyUser) {
        const [[conflictingUser]] = await db.query('SELECT id FROM users WHERE username=? AND id<>? LIMIT 1', [username, legacyUser.id]);
        await db.query(
          "UPDATE users SET username=?,password=?,role='relawan',wilayah=?,nama_lengkap=?,status='aktif' WHERE id=?",
          [conflictingUser ? legacyUsername : username, hash, wilayah, nama, legacyUser.id],
        );
      }
    }

    const accounts = [
      ['superadmin', hash, 'superadmin', 'SEMUA', 'Super Admin Life Media'],
      ['adminwilayahsalam', hash, 'admin', 'SALAM', 'Admin Wilayah Salam'],
      ...relawanAccounts.map(([, username, wilayah, nama]) => [username, hash, 'relawan', wilayah, nama]),
    ];

    for (const account of accounts) {
      await db.query(
        `INSERT INTO users(username,password,role,wilayah,nama_lengkap,status)
         VALUES (?,?,?,?,?,'aktif')
         ON DUPLICATE KEY UPDATE password=VALUES(password),role=VALUES(role),wilayah=VALUES(wilayah),nama_lengkap=VALUES(nama_lengkap),status='aktif'`,
        account,
      );
    }

    console.log('Seeder selesai. Password seluruh akun seed: admin123');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
