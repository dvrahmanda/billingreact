const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { demo, isDemo, isOfficialRegion, normalize } = require('../utils/helpers');
const { recordActivity } = require('../services/activityService');

function tokenFor(user) {
  const secret = process.env.JWT_SECRET || (isDemo() ? 'dev-secret' : '');
  if (!secret) throw new Error('JWT_SECRET wajib dikonfigurasi.');
  return jwt.sign({
    id: user.id,
    username: user.username,
    role: user.role,
    wilayah: user.wilayah,
    nama_lengkap: user.nama_lengkap,
    pelanggan_id: user.pelanggan_id || null,
    technician_id: user.technician_id || null,
  }, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

exports.login = async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });

    let user;
    if (isDemo()) {
      user = demo.users.find((item) => item.username === username && item.status === 'aktif');
      if (!user || user.password !== password) return res.status(401).json({ success: false, message: 'Username atau password salah.' });
    } else {
      const [rows] = await db.query("SELECT * FROM users WHERE username=? AND status='aktif' LIMIT 1", [username]);
      user = rows[0];
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ success: false, message: 'Username atau password salah.' });
      }
      if (user.role === 'pelanggan') {
        const [[customer]] = await db.query('SELECT id,alamat FROM pelanggan_salam WHERE user_id=? LIMIT 1', [user.id]);
        user.pelanggan_id = customer?.id || null;
        user.wilayah = customer?.alamat || user.wilayah;
      }
      if (user.role === 'teknisi') {
        const [[technician]] = await db.query('SELECT id,wilayah_tugas FROM technicians WHERE user_id=? LIMIT 1', [user.id]);
        user.technician_id = technician?.id || null;
        user.wilayah = technician?.wilayah_tugas || user.wilayah;
      }
    }

    user.role = String(user.role || '').trim().toLowerCase();
    if (user.role === 'admin') user.wilayah = normalize(user.wilayah);

    if (user.role === 'pelanggan' && !user.pelanggan_id) {
      return res.status(403).json({ success: false, message: 'Akun pelanggan belum terhubung ke data pelanggan.' });
    }
    if (user.role === 'teknisi' && !user.technician_id) {
      return res.status(403).json({ success: false, message: 'Akun teknisi belum terhubung ke data teknisi.' });
    }
    if (user.role === 'admin' && !isOfficialRegion(user.wilayah)) {
      return res.status(403).json({ success: false, message: 'Akun Admin Wilayah belum memiliki wilayah resmi.' });
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      wilayah: user.wilayah,
      nama_lengkap: user.nama_lengkap,
      pelanggan_id: user.pelanggan_id || null,
      technician_id: user.technician_id || null,
    };
    const token = tokenFor(safeUser);
    await recordActivity({ user: safeUser, action: 'LOGIN', entity: 'auth', detail: 'Login berhasil', ip: req.ip });
    return res.json({ success: true, token, user: safeUser });
  } catch (error) {
    return next(error);
  }
};

exports.me = (req, res) => res.json({ success: true, data: req.user });
