const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { demo, isDemo, isOfficialRegion, normalize } = require('../utils/helpers');

const rejectAdminWithoutRegion = (user, res) => {
  if (['admin', 'relawan'].includes(user.role) && !isOfficialRegion(user.wilayah)) {
    res.status(403).json({ success: false, message: 'Akun wajib memiliki wilayah resmi.' });
    return true;
  }
  return false;
};

module.exports = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Sesi login diperlukan.' });
  const secret = process.env.JWT_SECRET || (isDemo() ? 'dev-secret' : '');
  if (!secret) return res.status(503).json({ success: false, message: 'JWT_SECRET belum dikonfigurasi.' });
  let claims;
  try { claims = jwt.verify(authorization.slice(7), secret); }
  catch { return res.status(401).json({ success: false, message: 'Sesi kedaluwarsa atau token tidak valid.' }); }

  if (isDemo()) {
    const current = demo.users.find((user) => user.id === Number(claims.id) && user.status === 'aktif');
    if (!current) return res.status(401).json({ success: false, message: 'Akun tidak aktif atau tidak ditemukan.' });
    req.user = { ...claims, role: current.role, wilayah: current.wilayah, nama_lengkap: current.nama_lengkap,
      pelanggan_id: current.pelanggan_id || claims.pelanggan_id || null, technician_id: current.technician_id || claims.technician_id || null };
    if (rejectAdminWithoutRegion(req.user, res)) return;
    return next();
  }

  try {
    const [[current]] = await db.query("SELECT id,username,role,wilayah,nama_lengkap,status FROM users WHERE id=?", [claims.id]);
    if (!current || current.status !== 'aktif') return res.status(401).json({ success: false, message: 'Akun tidak aktif atau tidak ditemukan.' });
    const role = String(current.role || '').trim().toLowerCase();
    const wilayah = ['admin', 'relawan'].includes(role) ? normalize(current.wilayah) : current.wilayah;
    const user = { ...claims, username: current.username, role, wilayah, nama_lengkap: current.nama_lengkap, pelanggan_id: null, technician_id: null };
    if (role === 'pelanggan') {
      const [[customer]] = await db.query('SELECT id,alamat FROM pelanggan_salam WHERE user_id=? LIMIT 1', [current.id]);
      if (!customer) return res.status(403).json({ success: false, message: 'Akun pelanggan belum terhubung ke data pelanggan.' });
      user.pelanggan_id = customer.id; user.wilayah = customer.alamat;
    }
    if (role === 'teknisi') {
      const [[technician]] = await db.query('SELECT id,wilayah_tugas FROM technicians WHERE user_id=? LIMIT 1', [current.id]);
      if (!technician) return res.status(403).json({ success: false, message: 'Akun teknisi belum terhubung ke data teknisi.' });
      user.technician_id = technician.id; user.wilayah = technician.wilayah_tugas;
    }
    req.user = user;
    if (rejectAdminWithoutRegion(req.user, res)) return;
    return next();
  } catch (error) { return next(error); }
};
