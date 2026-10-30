const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { demo, isDemo } = require('../utils/helpers');
const { WILAYAH_RESMI } = require('../config/constants');

const RELAWAN_ROLE = 'relawan';

exports.list = async (_req, res, next) => {
  try {
    if (isDemo()) return res.json({ success: true, data: demo.users.filter((user) => user.role === RELAWAN_ROLE).map(({ password, ...user }) => user) });
    const [rows] = await db.query("SELECT id,username,role,wilayah,nama_lengkap,nomor_telepon,status,created_at FROM users WHERE role='relawan' ORDER BY wilayah");
    return res.json({ success: true, data: rows });
  } catch (error) { return next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim(); const name = String(req.body.nama_lengkap || '').trim();
    const region = String(req.body.wilayah || '').toUpperCase(); const password = String(req.body.password || '');
    if (!/^[a-zA-Z0-9._-]{3,60}$/.test(username) || !name || password.length < 8 || !WILAYAH_RESMI.includes(region)) return res.status(400).json({ success: false, message: 'Nama, username valid, wilayah, dan password minimal 8 karakter wajib diisi.' });
    if (isDemo()) {
      if (demo.users.some((user) => user.username === username)) return res.status(409).json({ success: false, message: 'Username sudah digunakan.' });
      const user = { id: Math.max(0, ...demo.users.map((item) => item.id)) + 1, username, password, role: RELAWAN_ROLE, wilayah: region, nama_lengkap: name, nomor_telepon: req.body.nomor_telepon || null, status: 'aktif' };
      demo.users.push(user);
      const { password: _password, ...safe } = user;
      return res.status(201).json({ success: true, data: safe });
    }
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query("INSERT INTO users (username,password,role,wilayah,nama_lengkap,nomor_telepon,status) VALUES (?,?,'relawan',?,?,?,'aktif')", [username, hash, region, name, req.body.nomor_telepon || null]);
    return res.status(201).json({ success: true, data: { id: result.insertId, username, role: RELAWAN_ROLE, wilayah: region, nama_lengkap: name, status: 'aktif' } });
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
    if (!name || !WILAYAH_RESMI.includes(region) || !['aktif', 'nonaktif'].includes(status) || (password && password.length < 8)) return res.status(400).json({ success: false, message: 'Data Relawan tidak valid.' });
    if (isDemo()) {
      const user = demo.users.find((item) => item.id === id && item.role === RELAWAN_ROLE);
      if (!user) return res.status(404).json({ success: false, message: 'Relawan wilayah tidak ditemukan.' });
      Object.assign(user, { nama_lengkap: name, wilayah: region, nomor_telepon: phone || null, status });
      if (password) user.password = password;
      const { password: _password, ...safe } = user;
      return res.json({ success: true, data: safe });
    }
    const [[targetAdmin]] = await db.query("SELECT id FROM users WHERE id=? AND role='relawan'", [id]);
    if (!targetAdmin) return res.status(404).json({ success: false, message: 'Relawan wilayah tidak ditemukan.' });
    const fields = [name, region, phone || null, status, id];
    await db.query("UPDATE users SET nama_lengkap=?,wilayah=?,nomor_telepon=?,status=? WHERE id=? AND role='relawan'", fields);
    if (password) await db.query("UPDATE users SET password=? WHERE id=? AND role='relawan'", [await bcrypt.hash(password, 12), id]);
    const [[user]] = await db.query("SELECT id,username,role,wilayah,nama_lengkap,nomor_telepon,status FROM users WHERE id=? AND role='relawan'", [id]);
    if (!user) return res.status(404).json({ success: false, message: 'Relawan wilayah tidak ditemukan.' });
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
