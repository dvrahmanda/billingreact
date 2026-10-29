const path = require('node:path');
const fs = require('node:fs/promises');
const { Readable } = require('node:stream');
const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { WILAYAH_RESMI } = require('../config/constants');
const { demo, isDemo, paginate, normalize } = require('../utils/helpers');
const { rowAllowed } = require('../middleware/roleScope');
const { fetchPPPoE } = require('../services/pppoeProxyService');

const allowedStatuses = new Set(['Aktif', 'Tidak Aktif']);
const cleanString = (value) => String(value ?? '').trim();
const safeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = cleanString(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    return parsedDate.toISOString().slice(0, 10) === text ? text : null;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const coordinate = (value) => value == null || value === '' ? null : Number(value);

function validateCustomer(input, forcedWilayah) {
  const body = {
    id_pelanggan: cleanString(input.id_pelanggan),
    kode_pelanggan: cleanString(input.kode_pelanggan) || null,
    nama: cleanString(input.nama), nama_ktp: cleanString(input.nama_ktp), nik: cleanString(input.nik),
    nomor_pelanggan: cleanString(input.nomor_pelanggan || input.nomor_whatsapp),
    alamat: forcedWilayah || normalize(input.wilayah || input.alamat),
    alamat_lengkap: cleanString(input.alamat_lengkap || (input.wilayah ? input.alamat : '')),
    paket: cleanString(input.paket),
    tarif_langganan: Number(input.tarif_langganan ?? input.tarif),
    status_pelanggan: cleanString(input.status_pelanggan || 'Aktif'),
    tanggal_daftar: safeDate(input.tanggal_daftar || input.tanggal_aktif),
    koordinat_x: coordinate(input.koordinat_x), koordinat_y: coordinate(input.koordinat_y),
    pppoe_user: cleanString(input.pppoe_user) || null,
  };
  const errors = [];
  if (!body.id_pelanggan) errors.push('ID Pelanggan wajib diisi.');
  if (!body.nama) errors.push('Nama pelanggan wajib diisi.');
  if (!WILAYAH_RESMI.includes(body.alamat)) errors.push('Wilayah tidak dikenal.');
  if (!body.paket) errors.push('Paket internet wajib diisi.');
  if (!Number.isFinite(body.tarif_langganan) || body.tarif_langganan < 0) errors.push('Tarif harus berupa angka nol atau lebih.');
  if (body.koordinat_x !== null && (!Number.isFinite(body.koordinat_x) || body.koordinat_x < -180 || body.koordinat_x > 180)) errors.push('Longitude harus berada pada rentang -180 sampai 180.');
  if (body.koordinat_y !== null && (!Number.isFinite(body.koordinat_y) || body.koordinat_y < -90 || body.koordinat_y > 90)) errors.push('Latitude harus berada pada rentang -90 sampai 90.');
  if (!allowedStatuses.has(body.status_pelanggan)) errors.push('Status pelanggan tidak valid.');
  if (input.tanggal_daftar && !body.tanggal_daftar) errors.push('Tanggal aktif tidak valid.');
  return { body, errors };
}

function customerFromDemo(customer) {
  return { ...customer, wilayah: customer.alamat, tanggal_aktif: customer.tanggal_daftar, foto_rumah: customer.foto_rumah || null };
}

async function customerPppoe(customer) {
  if (!customer?.pppoe_user) return {};
  try {
    const account = (await fetchPPPoE()).find((row) => String(row.username).toLowerCase() === String(customer.pppoe_user).toLowerCase());
    return account ? {
      pppoe_status: account.status, pppoe_ip: account.ip, pppoe_mac: account.mac,
      pppoe_router: account.router, pppoe_uptime: account.uptime, pppoe_last_update: account.last_update,
    } : {};
  } catch { return {}; }
}

function listDemo(req) {
  const q = cleanString(req.query.q).toLowerCase();
  const status = cleanString(req.query.status);
  const region = req.wilayahScope && req.wilayahScope !== 'all' ? normalize(req.wilayahScope) : null;
  const rows = demo.customers.filter((customer) => {
    if (region && normalize(customer.alamat) !== region) return false;
    if (status && customer.status_pelanggan !== status) return false;
    if (q && !`${customer.nama} ${customer.id_pelanggan} ${customer.nomor_pelanggan || ''}`.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  const result = paginate(rows.map(customerFromDemo), req);
  return { success: true, ...result };
}

function whereForList(req) {
  const conditions = [];
  const values = [];
  if (req.wilayahScope && req.wilayahScope !== 'all') { conditions.push('p.alamat=?'); values.push(req.wilayahScope); }
  if (req.query.status) { conditions.push('p.status_pelanggan=?'); values.push(req.query.status); }
  if (req.query.q) {
    conditions.push('(p.nama LIKE ? OR p.id_pelanggan LIKE ? OR p.nomor_pelanggan LIKE ?)');
    const like = `%${cleanString(req.query.q)}%`;
    values.push(like, like, like);
  }
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', values };
}

exports.list = async (req, res, next) => {
  try {
    if (isDemo()) return res.json(listDemo(req));
    const { where, values } = whereForList(req);
    const { page, pageSize, offset } = require('../utils/helpers').pagination(req);
    const [[count]] = await db.query(`SELECT COUNT(*) total FROM pelanggan_salam p ${where}`, values);
    const [rows] = await db.query(
      `SELECT p.*,p.alamat wilayah,d.nama_ktp,d.nik,d.foto_rumah,d.koordinat_x,d.koordinat_y,d.pppoe_user
       FROM pelanggan_salam p LEFT JOIN pelanggan_detail_salam d ON d.pelanggan_id=p.id ${where}
       ORDER BY p.nama LIMIT ? OFFSET ?`, [...values, pageSize, offset],
    );
    return res.json({ success: true, data: rows, pagination: { page, page_size: pageSize, total: Number(count.total), pages: Math.ceil(Number(count.total) / pageSize) } });
  } catch (error) { return next(error); }
};

exports.detail = async (req, res, next) => {
  try {
    if (isDemo()) {
      const customer = demo.customers.find((item) => item.id === Number(req.params.id));
      if (!customer || !rowAllowed(req, customer.alamat)) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
      const complaints = demo.complaints.filter((item) => item.pelanggan_id === customer.id).map((item) => {
        const technician = demo.technicians.find((t) => t.id === item.teknisi_id);
        return { ...item, teknisi_nama: technician?.nama || null };
      });
      return res.json({ success: true, data: {
        ...customerFromDemo(customer), tagihan_history: demo.bills.filter((item) => item.pelanggan_id === customer.id),
        payment_history: demo.payments.filter((item) => item.pelanggan_id === customer.id), complaints,
        ...await customerPppoe(customer),
      } });
    }
    const [[customer]] = await db.query(
      `SELECT p.*,p.alamat wilayah,d.nama_ktp,d.nik,d.foto_rumah,d.koordinat_x,d.koordinat_y,d.pppoe_user,d.catatan
       FROM pelanggan_salam p LEFT JOIN pelanggan_detail_salam d ON d.pelanggan_id=p.id WHERE p.id=?`, [req.params.id],
    );
    if (!customer || !rowAllowed(req, customer.alamat)) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    const [bills] = await db.query('SELECT * FROM tagihan_salam WHERE pelanggan_id=? ORDER BY periode DESC', [customer.id]);
    const [payments] = await db.query('SELECT * FROM payments WHERE pelanggan_id=? ORDER BY created_at DESC', [customer.id]);
    const [complaints] = await db.query('SELECT id,nomor_tiket,kategori,status,created_at,teknisi_id FROM complaints WHERE pelanggan_id=? ORDER BY created_at DESC', [customer.id]);
    return res.json({ success: true, data: { ...customer, tagihan_history: bills, payment_history: payments, complaints, ...await customerPppoe(customer) } });
  } catch (error) { return next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const region = req.user.role === 'superadmin' ? null : req.user.wilayah;
    const { body, errors } = validateCustomer(req.body, region);
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(' ') });
    const mobileUsername = cleanString(req.body.username_mobile); const mobilePassword = String(req.body.password_mobile || '');
    if ((mobileUsername && mobilePassword.length < 8) || (!mobileUsername && mobilePassword)) return res.status(400).json({ success: false, message: 'Akun mobile memerlukan username dan password minimal 8 karakter.' });
    if (isDemo()) {
      if (demo.customers.some((item) => item.id_pelanggan.toLowerCase() === body.id_pelanggan.toLowerCase())) return res.status(409).json({ success: false, message: 'ID Pelanggan sudah digunakan.' });
      if (mobileUsername && demo.users.some((item) => item.username === mobileUsername)) return res.status(409).json({ success: false, message: 'Username akun mobile sudah digunakan.' });
      const id = Math.max(0, ...demo.customers.map((item) => item.id)) + 1;
      const userId = mobileUsername ? Math.max(0, ...demo.users.map((item) => item.id)) + 1 : null;
      const created = { ...body, id, user_id: userId, kode_pelanggan: body.kode_pelanggan || null, status_bayar: 'Belum Lunas', tagihan: body.tarif_langganan, pppoe_status: null };
      demo.customers.push(created);
      if (mobileUsername) demo.users.push({ id: userId, username: mobileUsername, password: mobilePassword, role: 'pelanggan', wilayah: created.alamat, nama_lengkap: created.nama, status: 'aktif', pelanggan_id: id });
      return res.status(201).json({ success: true, data: created });
    }
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const today = new Date().toISOString().slice(0, 10);
      const [result] = await connection.query(
        `INSERT INTO pelanggan_salam (id_pelanggan,kode_pelanggan,nama,nomor_pelanggan,alamat,alamat_lengkap,paket,tarif_langganan,tagihan,status_bayar,status_pelanggan,waktu,langganan_selesai,tanggal_daftar)
         VALUES (?,?,?,?,?,?,?,?,?,'Belum Lunas',?,?,?,?)`,
        [body.id_pelanggan, body.kode_pelanggan || null, body.nama, body.nomor_pelanggan || null, body.alamat, body.alamat_lengkap || null, body.paket, body.tarif_langganan, body.tarif_langganan, body.status_pelanggan, body.tanggal_daftar || today, body.tanggal_daftar || today, body.tanggal_daftar || today],
      );
      await connection.query(
        `INSERT INTO pelanggan_detail_salam (pelanggan_id,nama_ktp,nik,koordinat_x,koordinat_y,pppoe_user) VALUES (?,?,?,?,?,?)`,
        [result.insertId, body.nama_ktp || null, body.nik || null, body.koordinat_x ?? null, body.koordinat_y ?? null, body.pppoe_user || null],
      );
      if (mobileUsername) {
        const hash = await bcrypt.hash(mobilePassword, 12);
        const [user] = await connection.query("INSERT INTO users (username,password,role,wilayah,nama_lengkap,status) VALUES (?,?,'pelanggan',?,?,'aktif')", [mobileUsername, hash, body.alamat, body.nama]);
        await connection.query('UPDATE pelanggan_salam SET user_id=? WHERE id=?', [user.insertId, result.insertId]);
      }
      await connection.commit();
      return res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'ID Pelanggan sudah digunakan.' });
    return next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    let existing;
    if (isDemo()) existing = demo.customers.find((item) => item.id === id);
    else [[existing]] = await db.query('SELECT * FROM pelanggan_salam WHERE id=?', [id]);
    if (!existing || !rowAllowed(req, existing.alamat)) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    const region = req.user.role === 'superadmin' ? null : req.user.wilayah;
    const { body, errors } = validateCustomer({ ...existing, ...req.body, id_pelanggan: existing.id_pelanggan }, region);
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(' ') });
    if (isDemo()) {
      const updated = { ...existing, ...body, id, id_pelanggan: existing.id_pelanggan };
      demo.customers[demo.customers.findIndex((item) => item.id === id)] = updated;
      return res.json({ success: true, data: updated });
    }
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `UPDATE pelanggan_salam SET nama=?,kode_pelanggan=?,nomor_pelanggan=?,alamat=?,alamat_lengkap=?,paket=?,tarif_langganan=?,status_pelanggan=?,tanggal_daftar=? WHERE id=?`,
        [body.nama, body.kode_pelanggan || null, body.nomor_pelanggan || null, body.alamat, body.alamat_lengkap || null, body.paket, body.tarif_langganan, body.status_pelanggan, body.tanggal_daftar || existing.tanggal_daftar, id],
      );
      await connection.query(
        `INSERT INTO pelanggan_detail_salam (pelanggan_id,nama_ktp,nik,koordinat_x,koordinat_y,pppoe_user) VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE nama_ktp=VALUES(nama_ktp),nik=VALUES(nik),koordinat_x=VALUES(koordinat_x),koordinat_y=VALUES(koordinat_y),pppoe_user=VALUES(pppoe_user)`,
        [id, body.nama_ktp || null, body.nik || null, body.koordinat_x ?? null, body.koordinat_y ?? null, body.pppoe_user || null],
      );
      await connection.commit();
      return res.json({ success: true });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  } catch (error) { return next(error); }
};

const headerAliases = {
  id_pelanggan: ['id_pelanggan', 'id pelanggan', 'id'], kode_pelanggan: ['kode_pelanggan', 'kode pelanggan'],
  nama: ['nama', 'nama pelanggan', 'pelanggan'], nama_ktp: ['nama_ktp', 'nama ktp'], nik: ['nik'],
  nomor_pelanggan: ['nomor_pelanggan', 'nomor whatsapp', 'whatsapp', 'nomor telepon'],
  alamat_lengkap: ['alamat_lengkap', 'alamat lengkap', 'alamat'], wilayah: ['wilayah', 'region'],
  paket: ['paket', 'paket internet'], tarif_langganan: ['tarif_langganan', 'tarif', 'harga'],
  status_pelanggan: ['status_pelanggan', 'status'], tanggal_daftar: ['tanggal_daftar', 'tanggal aktif'],
  koordinat_x: ['koordinat_x', 'longitude', 'lng'], koordinat_y: ['koordinat_y', 'latitude', 'lat'], pppoe_user: ['pppoe_user', 'username pppoe'],
};
const normalizeHeader = (value) => cleanString(value).toLowerCase().replace(/[\s-]+/g, '_');
const unwrapCell = (value) => {
  if (value && typeof value === 'object' && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
  if (value && typeof value === 'object' && 'text' in value) return value.text;
  return value;
};

exports.previewImport = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Pilih file Excel terlebih dahulu.' });
    let matrix;
    if (path.extname(req.file.originalname).toLowerCase() === '.csv') {
      const workbook = new ExcelJS.Workbook();
      const sheet = await workbook.csv.read(Readable.from([req.file.buffer]));
      matrix = []; sheet.eachRow({ includeEmpty: false }, (row) => matrix.push(row.values.slice(1).map(unwrapCell)));
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) return res.status(400).json({ success: false, message: 'Workbook tidak memiliki sheet data.' });
      matrix = [];
      sheet.eachRow({ includeEmpty: false }, (row) => matrix.push(row.values.slice(1).map(unwrapCell)));
    }
    if (matrix.length < 2) return res.status(400).json({ success: false, message: 'File harus memiliki header dan setidaknya satu baris data.' });
    const columns = matrix[0].map((header) => {
      const normalized = normalizeHeader(header);
      return Object.entries(headerAliases).find(([, aliases]) => aliases.map(normalizeHeader).includes(normalized))?.[0] || null;
    });
    const rows = matrix.slice(1).map((values, index) => {
      const record = {};
      columns.forEach((key, columnIndex) => { if (key) record[key] = unwrapCell(values[columnIndex]); });
      if (!record.wilayah && WILAYAH_RESMI.includes(normalize(record.alamat_lengkap))) {
        record.wilayah = record.alamat_lengkap;
        record.alamat_lengkap = '';
      }
      const validated = validateCustomer(record, req.user.role === 'superadmin' ? null : req.user.wilayah);
      return { row_number: index + 2, values: validated.body, errors: validated.errors, status: validated.errors.length ? 'Error' : 'Valid' };
    }).filter((row) => Object.values(row.values).some((value) => value !== '' && value != null));
    const ids = new Set();
    for (const row of rows) {
      const key = row.values.id_pelanggan.toLowerCase();
      if (key && ids.has(key)) { row.status = 'Duplicate'; row.errors.push('ID Pelanggan duplikat di dalam file.'); }
      ids.add(key);
    }
    const incomingIds = rows.map((row) => row.values.id_pelanggan).filter(Boolean);
    let existingIds = new Set();
    if (incomingIds.length) {
      if (isDemo()) existingIds = new Set(demo.customers.filter((customer) => incomingIds.includes(customer.id_pelanggan)).map((customer) => customer.id_pelanggan.toLowerCase()));
      else {
        const [found] = await db.query(`SELECT id_pelanggan FROM pelanggan_salam WHERE id_pelanggan IN (${incomingIds.map(() => '?').join(',')})`, incomingIds);
        existingIds = new Set(found.map((item) => item.id_pelanggan.toLowerCase()));
      }
    }
    rows.forEach((row) => {
      if (row.status === 'Valid' && existingIds.has(row.values.id_pelanggan.toLowerCase())) {
        row.status = 'Duplicate'; row.errors.push('ID Pelanggan sudah ada di sistem.');
      }
    });
    const counts = rows.reduce((acc, row) => { acc[row.status.toLowerCase()] = (acc[row.status.toLowerCase()] || 0) + 1; return acc; }, {});
    return res.json({ success: true, data: rows, summary: { total: rows.length, ...counts } });
  } catch (error) { return next(error); }
};

exports.importRows = async (req, res, next) => {
  try {
    if (!Array.isArray(req.body.rows) || req.body.rows.length > 1000) return res.status(400).json({ success: false, message: 'Kirim maksimal 1.000 baris valid untuk diimpor.' });
    const region = req.user.role === 'superadmin' ? null : req.user.wilayah;
    const candidates = req.body.rows.map((row) => validateCustomer(row, region));
    const invalid = candidates.filter((item) => item.errors.length);
    if (invalid.length) return res.status(400).json({ success: false, message: 'Sebagian data berubah atau tidak valid. Lakukan preview ulang.', errors: invalid.map((item) => item.errors) });
    const ids = candidates.map((item) => item.body.id_pelanggan.toLowerCase());
    if (new Set(ids).size !== ids.length) return res.status(400).json({ success: false, message: 'File mengandung ID Pelanggan duplikat.' });
    if (isDemo()) {
      const existing = new Set(demo.customers.map((customer) => customer.id_pelanggan.toLowerCase()));
      const imported = [];
      const skipped = [];
      for (const { body } of candidates) {
        if (existing.has(body.id_pelanggan.toLowerCase())) { skipped.push({ id_pelanggan: body.id_pelanggan, status: 'Duplicate' }); continue; }
        const id = Math.max(0, ...demo.customers.map((customer) => customer.id)) + 1;
        demo.customers.push({ ...body, id, tagihan: body.tarif_langganan, status_bayar: 'Belum Lunas' });
        existing.add(body.id_pelanggan.toLowerCase()); imported.push(body.id_pelanggan);
      }
      return res.json({ success: true, data: { imported: imported.length, skipped: skipped.length, errors: 0, results: [...imported.map((id_pelanggan) => ({ id_pelanggan, status: 'Imported' })), ...skipped] } });
    }
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const imported = [];
      const skipped = [];
      for (const { body } of candidates) {
        const [exists] = await connection.query('SELECT id FROM pelanggan_salam WHERE id_pelanggan=? FOR UPDATE', [body.id_pelanggan]);
        if (exists.length) { skipped.push({ id_pelanggan: body.id_pelanggan, status: 'Duplicate' }); continue; }
        const date = body.tanggal_daftar || new Date().toISOString().slice(0, 10);
        const [created] = await connection.query(
          `INSERT INTO pelanggan_salam (id_pelanggan,kode_pelanggan,nama,nomor_pelanggan,alamat,alamat_lengkap,paket,tarif_langganan,tagihan,status_bayar,status_pelanggan,waktu,langganan_selesai,tanggal_daftar)
           VALUES (?,?,?,?,?,?,?,?,?,'Belum Lunas',?,?,?,?)`,
          [body.id_pelanggan, body.kode_pelanggan || null, body.nama, body.nomor_pelanggan || null, body.alamat, body.alamat_lengkap || null, body.paket, body.tarif_langganan, body.tarif_langganan, body.status_pelanggan, date, date, date],
        );
        await connection.query('INSERT INTO pelanggan_detail_salam (pelanggan_id,nama_ktp,nik,koordinat_x,koordinat_y,pppoe_user) VALUES (?,?,?,?,?,?)', [created.insertId, body.nama_ktp || null, body.nik || null, body.koordinat_x ?? null, body.koordinat_y ?? null, body.pppoe_user || null]);
        imported.push(body.id_pelanggan);
      }
      await connection.commit();
      return res.json({ success: true, data: { imported: imported.length, skipped: skipped.length, errors: 0, results: [...imported.map((id_pelanggan) => ({ id_pelanggan, status: 'Imported' })), ...skipped] } });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  } catch (error) { return next(error); }
};

exports.exportExcel = async (req, res, next) => {
  try {
    let rows;
    if (isDemo()) rows = listDemo({ ...req, query: { ...req.query, page: 1, page_size: 100000 } }).data;
    else {
      const { where, values } = whereForList(req);
      [rows] = await db.query(`SELECT p.*,p.alamat wilayah,d.nama_ktp,d.nik,d.koordinat_x,d.koordinat_y,d.pppoe_user FROM pelanggan_salam p LEFT JOIN pelanggan_detail_salam d ON d.pelanggan_id=p.id ${where} ORDER BY p.nama`, values);
    }
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Pelanggan');
    sheet.columns = [
      { header: 'ID Pelanggan', key: 'id_pelanggan', width: 18 }, { header: 'Kode Pelanggan', key: 'kode_pelanggan', width: 18 },
      { header: 'Nama', key: 'nama', width: 28 }, { header: 'Nama KTP', key: 'nama_ktp', width: 28 }, { header: 'NIK', key: 'nik', width: 20 },
      { header: 'Nomor WhatsApp', key: 'nomor_pelanggan', width: 20 }, { header: 'Alamat Lengkap', key: 'alamat_lengkap', width: 34 },
      { header: 'Wilayah', key: 'wilayah', width: 18 }, { header: 'Paket', key: 'paket', width: 18 }, { header: 'Tarif', key: 'tarif_langganan', width: 16 },
      { header: 'Status', key: 'status_pelanggan', width: 16 }, { header: 'Tanggal Aktif', key: 'tanggal_daftar', width: 16 },
      { header: 'Longitude', key: 'koordinat_x', width: 16 }, { header: 'Latitude', key: 'koordinat_y', width: 16 }, { header: 'Username PPPoE', key: 'pppoe_user', width: 22 },
    ];
    sheet.addRows(rows.map((row) => ({ ...row, wilayah: row.wilayah || row.alamat })));
    sheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="pelanggan.xlsx"');
    return res.send(Buffer.from(buffer));
  } catch (error) { return next(error); }
};

exports.importTemplate = async (_req, res, next) => {
  try {
    const templatePath = path.resolve(__dirname, '../../template_import_pelanggan.xlsx');
    const template = await fs.readFile(templatePath);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template_import_pelanggan.xlsx"');
    return res.send(template);
  } catch (error) { return next(error); }
};

exports.linkMobileAccount = async (req, res, next) => {
  try {
    const id = Number(req.params.id); const username = cleanString(req.body.username); const password = String(req.body.password || '');
    if (!username || password.length < 8) return res.status(400).json({ success: false, message: 'Username dan password minimal 8 karakter wajib diisi.' });
    if (isDemo()) {
      const customer = demo.customers.find((item) => item.id === id);
      if (!customer || !rowAllowed(req, customer.alamat)) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
      const existingUser = demo.users.find((item) => item.username === username && item.id !== customer.user_id);
      if (existingUser) return res.status(409).json({ success: false, message: 'Username sudah digunakan.' });
      let user = demo.users.find((item) => item.id === customer.user_id);
      if (user) Object.assign(user, { username, password, role: 'pelanggan', wilayah: customer.alamat, nama_lengkap: customer.nama, status: 'aktif', pelanggan_id: id });
      else {
        user = { id: Math.max(0, ...demo.users.map((item) => item.id)) + 1, username, password, role: 'pelanggan', wilayah: customer.alamat, nama_lengkap: customer.nama, status: 'aktif', pelanggan_id: id };
        demo.users.push(user); customer.user_id = user.id;
      }
      return res.json({ success: true, data: { username, linked: true } });
    }
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [[customer]] = await connection.query('SELECT * FROM pelanggan_salam WHERE id=? FOR UPDATE', [id]);
      if (!customer || !rowAllowed(req, customer.alamat)) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' }); }
      const hash = await bcrypt.hash(password, 12);
      let userId = customer.user_id;
      if (userId) {
        await connection.query("UPDATE users SET username=?,password=?,role='pelanggan',wilayah=?,nama_lengkap=?,status='aktif' WHERE id=?", [username, hash, customer.alamat, customer.nama, userId]);
      } else {
        const [user] = await connection.query("INSERT INTO users (username,password,role,wilayah,nama_lengkap,status) VALUES (?,?,'pelanggan',?,?,'aktif')", [username, hash, customer.alamat, customer.nama]);
        userId = user.insertId;
        await connection.query('UPDATE pelanggan_salam SET user_id=? WHERE id=?', [userId, id]);
      }
      await connection.commit();
      return res.json({ success: true, data: { username, linked: true } });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Username sudah digunakan.' });
    return next(error);
  }
};

exports.uploadPhoto = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Pilih foto rumah terlebih dahulu.' });
    const id = Number(req.params.id);
    if (isDemo()) {
      const customer = demo.customers.find((item) => item.id === id);
      if (!customer || !rowAllowed(req, customer.alamat)) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
      customer.foto_rumah = `/uploads/foto_rumah/${path.basename(req.file.path)}`;
      return res.json({ success: true, data: { foto_rumah: customer.foto_rumah } });
    }
    const [[customer]] = await db.query('SELECT id,alamat FROM pelanggan_salam WHERE id=?', [id]);
    if (!customer || !rowAllowed(req, customer.alamat)) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    const relative = `/uploads/foto_rumah/${path.basename(req.file.path)}`;
    await db.query('INSERT INTO pelanggan_detail_salam (pelanggan_id,foto_rumah) VALUES (?,?) ON DUPLICATE KEY UPDATE foto_rumah=VALUES(foto_rumah)', [id, relative]);
    return res.json({ success: true, data: { foto_rumah: relative } });
  } catch (error) { return next(error); }
};
