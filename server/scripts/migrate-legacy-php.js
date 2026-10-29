require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('node:fs');
const { WILAYAH_RESMI } = require('../config/constants');

const targetName = process.env.DB_NAME || 'billing_lifemedia';
const sourceName = process.env.LEGACY_DB_NAME;
if (!sourceName) throw new Error('Isi LEGACY_DB_NAME dengan nama database PHP lama.');
if (sourceName.toLowerCase() === targetName.toLowerCase()) throw new Error('Database sumber dan target harus berbeda agar database PHP tetap aman.');
if (String(process.env.DEMO_MODE || 'true').toLowerCase() !== 'false') throw new Error('Set DEMO_MODE=false sebelum menjalankan migrasi.');

const common = {
  waitForConnections: true,
  connectionLimit: 3,
  timezone: '+07:00',
  dateStrings: true,
};
const source = mysql.createPool({
  ...common,
  host: process.env.LEGACY_DB_HOST || process.env.DB_HOST || 'localhost',
  user: process.env.LEGACY_DB_USER || process.env.DB_USER || 'root',
  password: process.env.LEGACY_DB_PASSWORD ?? process.env.DB_PASSWORD ?? '',
  database: sourceName,
  port: Number(process.env.LEGACY_DB_PORT || process.env.DB_PORT || 3306),
});
const target = mysql.createPool({
  ...common,
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: targetName,
  port: Number(process.env.DB_PORT || 3306),
});

async function tableExists(pool, table) {
  const [[row]] = await pool.query('SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?', [table]);
  return Number(row.count) > 0;
}

async function getColumns(pool, table) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
  return new Set(rows.map((row) => row.Field));
}

async function requireSourceTable(table) {
  if (!await tableExists(source, table)) throw new Error(`Tabel ${table} tidak ditemukan di database PHP lama.`);
}

async function run() {
  await requireSourceTable('users');
  await requireSourceTable('pelanggan_salam');
  await requireSourceTable('tagihan_salam');
  for (const table of ['users', 'pelanggan_salam', 'tagihan_salam', 'pelanggan_detail_salam', 'wilayah_configs', 'payments', 'complaints', 'technicians']) {
    if (!await tableExists(target, table)) throw new Error(`Schema React belum lengkap: tabel ${table} tidak ada. Import database/schema_lifemedia.sql dahulu.`);
  }

  const [[existing]] = await target.query('SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM pelanggan_salam) customers,(SELECT COUNT(*) FROM tagihan_salam) bills');
  if (Number(existing.users) || Number(existing.customers) || Number(existing.bills)) {
    throw new Error('Database target tidak kosong. Gunakan database React baru agar data tidak tercampur atau tertimpa.');
  }

  const userColumns = await getColumns(source, 'users');
  const customerColumns = await getColumns(source, 'pelanggan_salam');
  const billColumns = await getColumns(source, 'tagihan_salam');
  const [users] = await source.query('SELECT * FROM users ORDER BY id');
  const [customers] = await source.query('SELECT * FROM pelanggan_salam ORDER BY id');
  const [bills] = await source.query('SELECT * FROM tagihan_salam ORDER BY periode,id');
  const normalizeRegion = (value) => String(value || '').trim().toUpperCase();
  const supportedRegions = new Set(WILAYAH_RESMI);
  if (customers.some((row) => !normalizeRegion(row.alamat))) {
    throw new Error('Ada pelanggan tanpa wilayah di database lama. Lengkapi wilayahnya sebelum mengulang migrasi.');
  }
  const customerById = new Map(customers.map((row) => [Number(row.id), row]));
  const supportedCustomers = customers.filter((row) => supportedRegions.has(normalizeRegion(row.alamat)));
  const supportedCustomerIds = new Set(supportedCustomers.map((row) => Number(row.id)));
  const customerRegionByUserId = new Map(supportedCustomers
    .filter((row) => row.user_id != null)
    .map((row) => [Number(row.user_id), normalizeRegion(row.alamat)]));
  const broadAdminUsers = users.filter((row) => {
    const legacyRole = String(row.role || 'admin').toLowerCase();
    const region = normalizeRegion(row.wilayah) || customerRegionByUserId.get(Number(row.id)) || '';
    return legacyRole === 'admin' && ['SEMUA', 'ALL'].includes(region);
  });
  if (broadAdminUsers.length) {
    const names = broadAdminUsers.map((row) => row.username || `ID ${row.id}`).join(', ');
    throw new Error(`Migrasi dihentikan: akun Admin lama dengan wilayah SEMUA/ALL (${names}) tidak dapat dipetakan otomatis. Tetapkan role dan wilayahnya secara manual sebelum mengulang migrasi.`);
  }
  const importableUsers = users.filter((row) => {
    const legacyRole = String(row.role || 'admin').toLowerCase();
    const region = normalizeRegion(row.wilayah) || customerRegionByUserId.get(Number(row.id)) || '';
    return ['superadmin', 'admin', 'teknisi', 'pelanggan'].includes(legacyRole)
      && (legacyRole === 'superadmin' || supportedRegions.has(region));
  });
  const userIds = new Set(importableUsers.map((row) => Number(row.id)));
  const detailFields = ['nama_ktp', 'nik', 'foto_rumah', 'koordinat_x', 'koordinat_y', 'pppoe_user', 'catatan'];
  const regionConfigFile = process.env.LEGACY_CONFIG_PATH;
  const legacyRegionConfigs = regionConfigFile ? JSON.parse(fs.readFileSync(regionConfigFile, 'utf8')) : null;
  const copied = { users: 0, customers: 0, bills: 0, customerDetails: 0, messageLogs: 0, regionConfigs: 0, excludedUsers: 0, excludedCustomers: 0, excludedBills: 0, excludedMessageLogs: 0, unsupportedConfigs: 0 };
  const connection = await target.getConnection();
  try {
    await connection.beginTransaction();
    copied.excludedUsers = users.length - importableUsers.length;
    for (const row of importableUsers) {
      const legacyRole = String(row.role || 'admin').toLowerCase();
      const region = normalizeRegion(row.wilayah) || customerRegionByUserId.get(Number(row.id)) || '';
      const role = legacyRole;
      const name = row.nama_lengkap || row.nama || row.username;
      await connection.query(
        `INSERT INTO users (id,username,password,role,wilayah,nama_lengkap,nomor_telepon,status,created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [row.id, row.username, row.password, role, region || (role === 'superadmin' ? 'SEMUA' : 'SALAM'), name,
          userColumns.has('nomor_telepon') ? row.nomor_telepon || null : null,
          userColumns.has('status') && ['aktif', 'nonaktif'].includes(String(row.status).toLowerCase()) ? String(row.status).toLowerCase() : 'aktif',
          row.created_at || new Date()],
      );
      copied.users += 1;
    }

    copied.excludedCustomers = customers.length - supportedCustomers.length;
    for (const row of supportedCustomers) {
      const id = Number(row.id);
      if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new Error(`ID pelanggan ${row.id} tidak bisa disimpan pada format database React.`);
      if (!row.alamat) throw new Error(`Pelanggan ${row.id_pelanggan || row.id} belum memiliki wilayah; isi wilayah di database lama lalu ulangi migrasi.`);
      const userId = customerColumns.has('user_id') && userIds.has(Number(row.user_id)) ? Number(row.user_id) : null;
      await connection.query(
        `INSERT INTO pelanggan_salam (id,id_pelanggan,kode_pelanggan,nama,nomor_pelanggan,alamat,alamat_lengkap,paket,tarif_langganan,tagihan,status_bayar,status_pelanggan,waktu,langganan_selesai,tanggal_daftar,tanggal_bayar,nominal_dibayar,nomor_invoice,user_id,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, row.id_pelanggan, row.kode_pelanggan || null, row.nama, row.nomor_pelanggan || null, normalizeRegion(row.alamat),
          customerColumns.has('alamat_lengkap') ? row.alamat_lengkap || null : null,
          row.paket || '', row.tarif_langganan || 0, row.tagihan || 0,
          ['Lunas', 'Belum Lunas'].includes(row.status_bayar) ? row.status_bayar : 'Belum Lunas',
          ['Aktif', 'Tidak Aktif'].includes(row.status_pelanggan) ? row.status_pelanggan : 'Aktif',
          row.waktu, row.langganan_selesai || row.waktu, row.tanggal_daftar || null, row.tanggal_bayar || null,
          row.nominal_dibayar || null, row.nomor_invoice || null, userId, row.created_at || new Date()],
      );
      copied.customers += 1;

      const availableDetailFields = detailFields.filter((field) => customerColumns.has(field));
      const values = availableDetailFields.map((field) => row[field]);
      if (availableDetailFields.length && values.some((value) => value !== null && value !== undefined && value !== '')) {
        const detail = Object.fromEntries(availableDetailFields.map((field, index) => [field, values[index] || null]));
        await connection.query(
          `INSERT INTO pelanggan_detail_salam (pelanggan_id,${availableDetailFields.map((field) => `\`${field}\``).join(',')}) VALUES (${['?'.repeat(1), ...availableDetailFields.map(() => '?')].join(',')})`,
          [id, ...availableDetailFields.map((field) => detail[field])],
        );
        copied.customerDetails += 1;
      }
    }

    for (const row of bills) {
      const customerId = Number(row.pelanggan_id);
      if (customerById.has(customerId) && !supportedCustomerIds.has(customerId)) {
        copied.excludedBills += 1;
        continue;
      }
      if (!supportedCustomerIds.has(customerId)) throw new Error(`Tagihan periode ${row.periode} mengacu ke pelanggan ${row.pelanggan_id} yang tidak ada.`);
      const paidDate = row.tanggal_bayar || null;
      const customerRegion = normalizeRegion(customerById.get(customerId).alamat);
      await connection.query(
        `INSERT INTO tagihan_salam (pelanggan_id,periode,id_pelanggan_snapshot,nama_snapshot,alamat_snapshot,paket_snapshot,tarif_snapshot,nominal_tagihan,status_bayar,tanggal_jatuh_tempo,tanggal_bayar,nominal_dibayar,nomor_invoice,metode_pembayaran,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [row.pelanggan_id, row.periode, row.id_pelanggan_snapshot || '', row.nama_snapshot || '', supportedRegions.has(normalizeRegion(row.alamat_snapshot)) ? normalizeRegion(row.alamat_snapshot) : customerRegion,
          row.paket_snapshot || '', row.tarif_snapshot || 0, row.nominal_tagihan || 0,
          ['Lunas', 'Belum Lunas'].includes(row.status_bayar) ? row.status_bayar : 'Belum Lunas', row.tanggal_jatuh_tempo || row.periode,
          paidDate, row.nominal_dibayar || null, row.nomor_invoice || null,
          billColumns.has('metode_pembayaran') ? row.metode_pembayaran || null : null, row.created_at || new Date()],
      );
      copied.bills += 1;
    }

    if (await tableExists(source, 'message_send_log') && await tableExists(target, 'message_send_log')) {
      const [logs] = await source.query('SELECT * FROM message_send_log ORDER BY id');
      for (const row of logs) {
        const region = normalizeRegion(row.wilayah);
        const logCustomerId = Number(row.id_pelanggan);
        if (!supportedRegions.has(region) || (row.id_pelanggan != null && customerById.has(logCustomerId) && !supportedCustomerIds.has(logCustomerId))) {
          copied.excludedMessageLogs += 1;
          continue;
        }
        await connection.query('INSERT INTO message_send_log (id,wilayah,id_pelanggan,message_type,created_at) VALUES (?,?,?,?,?)', [row.id, region, row.id_pelanggan || null, row.message_type || 'tagihan', row.created_at || new Date()]);
        copied.messageLogs += 1;
      }
    }
    if (legacyRegionConfigs && typeof legacyRegionConfigs === 'object' && !Array.isArray(legacyRegionConfigs)) {
      for (const [key, config] of Object.entries(legacyRegionConfigs)) {
        const region = normalizeRegion(config?.wilayah || key);
        if (!supportedRegions.has(region)) { copied.unsupportedConfigs += 1; continue; }
        const name = String(config.nama_layanan || `Life Media ${region}`).slice(0, 150);
        await connection.query(
          'INSERT INTO wilayah_configs (wilayah,nama_layanan,nomor_whatsapp) VALUES (?,?,?) ON DUPLICATE KEY UPDATE nama_layanan=VALUES(nama_layanan),nomor_whatsapp=VALUES(nomor_whatsapp)',
          [region, name, String(config.nomor_whatsapp || '').slice(0, 30) || null],
        );
        copied.regionConfigs += 1;
      }
    }
    await connection.commit();
    console.log(`Migrasi selesai: ${copied.users} pengguna, ${copied.customers} pelanggan, ${copied.bills} tagihan, ${copied.customerDetails} profil detail, ${copied.messageLogs} log WhatsApp, ${copied.regionConfigs} konfigurasi wilayah.`);
    const excludedData = copied.excludedUsers + copied.excludedCustomers + copied.excludedBills + copied.excludedMessageLogs;
    if (excludedData) console.log(`Data di luar enam wilayah resmi tidak diimpor: ${copied.excludedUsers} pengguna, ${copied.excludedCustomers} pelanggan, ${copied.excludedBills} tagihan, ${copied.excludedMessageLogs} log WhatsApp.`);
    if (copied.unsupportedConfigs) console.log(`${copied.unsupportedConfigs} konfigurasi wilayah lama tidak diimpor karena wilayahnya tidak termasuk dalam daftar React saat ini.`);
    console.log('Database PHP lama tidak diubah. Periksa login, pelanggan, tagihan, dan riwayat sebelum mengganti DB_NAME aplikasi.');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await Promise.all([source.end(), target.end()]);
  }
}

run().catch((error) => {
  console.error(`Migrasi dibatalkan: ${error.message}`);
  Promise.allSettled([source.end(), target.end()]).finally(() => { process.exitCode = 1; });
});
