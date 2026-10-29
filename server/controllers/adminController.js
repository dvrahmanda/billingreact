const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { demo, isDemo } = require('../utils/helpers');
const { WILAYAH_RESMI } = require('../config/constants');

const normalizeRegion = (value) => String(value || '').trim().toUpperCase();

exports.list = async (_req, res, next) => {
  try {
    if (isDemo()) return res.json({ success: true, data: demo.users.filter((user) => user.role === 'admin').map(({ password, ...user }) => user) });
    const [rows] = await db.query("SELECT id,username,role,wilayah,nama_lengkap,nomor_telepon,status,created_at FROM users WHERE role='admin' ORDER BY wilayah");
    return res.json({ success: true, data: rows });
  } catch (error) { return next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim(); const name = String(req.body.nama_lengkap || '').trim();
    const region = String(req.body.wilayah || '').toUpperCase(); const password = String(req.body.password || '');
    if (!username || !name || password.length < 8 || !WILAYAH_RESMI.includes(region)) return res.status(400).json({ success: false, message: 'Nama, username, wilayah valid, dan password minimal 8 karakter wajib diisi.' });
    if (isDemo()) {
      if (demo.users.some((user) => user.username === username)) return res.status(409).json({ success: false, message: 'Username sudah digunakan.' });
      if (demo.users.some((user) => user.role === 'admin' && user.status === 'aktif' && normalizeRegion(user.wilayah) === region)) return res.status(409).json({ success: false, message: `Wilayah ${region} sudah memiliki akun Admin Wilayah aktif.` });
      const user = { id: Math.max(0, ...demo.users.map((item) => item.id)) + 1, username, password, role: 'admin', wilayah: region, nama_lengkap: name, nomor_telepon: req.body.nomor_telepon || null, status: 'aktif' };
      demo.users.push(user);
      const { password: _password, ...safe } = user;
      return res.status(201).json({ success: true, data: safe });
    }
    const [existingRegionAdmin] = await db.query("SELECT id FROM users WHERE role='admin' AND status='aktif' AND UPPER(TRIM(wilayah))=? LIMIT 1", [region]);
    if (existingRegionAdmin.length) return res.status(409).json({ success: false, message: `Wilayah ${region} sudah memiliki akun Admin Wilayah aktif.` });
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query("INSERT INTO users (username,password,role,wilayah,nama_lengkap,nomor_telepon,status) VALUES (?,?,'admin',?,?,?,'aktif')", [username, hash, region, name, req.body.nomor_telepon || null]);
    return res.status(201).json({ success: true, data: { id: result.insertId, username, role: 'admin', wilayah: region, nama_lengkap: name, status: 'aktif' } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Username sudah digunakan.' });
    return next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = Number(req.params.id); const name = String(req.body.nama_lengkap || '').trim();
    const region = String(req.body.wilayah || '').toUpperCase(); const phone = String(req.body.nomor_telepon || '').trim();
    const status = String(req.body.status || 'aktif'); const password = String(req.body.password || '');
    if (!name || !WILAYAH_RESMI.includes(region) || !['aktif', 'nonaktif'].includes(status) || (password && password.length < 8)) return res.status(400).json({ success: false, message: 'Data admin tidak valid.' });
    if (isDemo()) {
      const user = demo.users.find((item) => item.id === id && item.role === 'admin');
      if (!user) return res.status(404).json({ success: false, message: 'Admin wilayah tidak ditemukan.' });
      if (status === 'aktif' && demo.users.some((item) => item.id !== id && item.role === 'admin' && item.status === 'aktif' && normalizeRegion(item.wilayah) === region)) return res.status(409).json({ success: false, message: `Wilayah ${region} sudah digunakan Admin Wilayah aktif lain.` });
      Object.assign(user, { nama_lengkap: name, wilayah: region, nomor_telepon: phone || null, status });
      if (password) user.password = password;
      const { password: _password, ...safe } = user;
      return res.json({ success: true, data: safe });
    }
    const [[targetAdmin]] = await db.query("SELECT id FROM users WHERE id=? AND role='admin'", [id]);
    if (!targetAdmin) return res.status(404).json({ success: false, message: 'Admin wilayah tidak ditemukan.' });
    if (status === 'aktif') {
      const [existingRegionAdmin] = await db.query("SELECT id FROM users WHERE role='admin' AND status='aktif' AND UPPER(TRIM(wilayah))=? AND id<>? LIMIT 1", [region, id]);
      if (existingRegionAdmin.length) return res.status(409).json({ success: false, message: `Wilayah ${region} sudah digunakan Admin Wilayah aktif lain.` });
    }
    const fields = [name, region, phone || null, status, id];
    await db.query("UPDATE users SET nama_lengkap=?,wilayah=?,nomor_telepon=?,status=? WHERE id=? AND role='admin'", fields);
    if (password) await db.query("UPDATE users SET password=? WHERE id=? AND role='admin'", [await bcrypt.hash(password, 12), id]);
    const [[user]] = await db.query("SELECT id,username,role,wilayah,nama_lengkap,nomor_telepon,status FROM users WHERE id=? AND role='admin'", [id]);
    if (!user) return res.status(404).json({ success: false, message: 'Admin wilayah tidak ditemukan.' });
    return res.json({ success: true, data: user });
  } catch (error) { return next(error); }
};

exports.activity = async (_req, res, next) => {
  try {
    if (isDemo()) return res.json({ success: true, data: demo.activity.slice(0, 500) });
    const [rows] = await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500');
    return res.json({ success: true, data: rows });
  } catch (error) { return next(error); }
};
