const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { demo, isDemo, normalize } = require('../utils/helpers');
const { WILAYAH_RESMI } = require('../config/constants');

exports.list = async (req, res, next) => {
  try {
    if (isDemo()) {
      let rows = demo.technicians.map((technician) => {
        const tasks = demo.complaints.filter((item) => item.teknisi_id === technician.id);
        return { ...technician, active_jobs: tasks.filter((item) => !['closed', 'ditolak'].includes(item.status)).length,
          completed_jobs: tasks.filter((item) => item.status === 'closed').length };
      });
      if (req.user.role !== 'superadmin') rows = rows.filter((item) => normalize(item.wilayah_tugas) === normalize(req.user.wilayah));
      return res.json({ success: true, data: rows });
    }
    const params = []; let where = '';
    if (req.user.role !== 'superadmin') { where = 'WHERE t.wilayah_tugas=?'; params.push(req.user.wilayah); }
    const [rows] = await db.query(
      `SELECT t.*,(SELECT COUNT(*) FROM complaints c WHERE c.teknisi_id=t.id AND c.status NOT IN ('closed','ditolak')) active_jobs,
       (SELECT COUNT(*) FROM complaints c WHERE c.teknisi_id=t.id AND c.status IN ('penanganan_selesai','closed')) completed_jobs
       FROM technicians t ${where} ORDER BY t.wilayah_tugas,t.nama`, params,
    );
    return res.json({ success: true, data: rows });
  } catch (error) { return next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const nama = String(req.body.nama || '').trim(); const phone = String(req.body.nomor_whatsapp || '').trim();
    const region = String(req.body.wilayah_tugas || '').toUpperCase(); const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!nama || !phone || !WILAYAH_RESMI.includes(region)) return res.status(400).json({ success: false, message: 'Nama, nomor WhatsApp, dan wilayah tugas yang valid wajib diisi.' });
    if ((username && password.length < 8) || (password && !username)) return res.status(400).json({ success: false, message: 'Akun mobile memerlukan username dan password minimal 8 karakter.' });
    if (isDemo()) {
      if (username && demo.users.some((item) => item.username === username)) return res.status(409).json({ success: false, message: 'Username sudah digunakan.' });
      const id = Math.max(0, ...demo.technicians.map((item) => item.id)) + 1;
      const userId = username ? Math.max(0, ...demo.users.map((item) => item.id)) + 1 : null;
      const created = { id, nama, nomor_whatsapp: phone, wilayah_tugas: region, status: 'tersedia', user_id: userId, active_jobs: 0, completed_jobs: 0 };
      demo.technicians.push(created);
      if (username) demo.users.push({ id: userId, username, password, role: 'teknisi', wilayah: region, nama_lengkap: nama, status: 'aktif', technician_id: id });
      return res.status(201).json({ success: true, data: created });
    }
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      let userId = null;
      if (username) {
        const hash = await bcrypt.hash(password, 12);
        const [user] = await connection.query('INSERT INTO users (username,password,role,wilayah,nama_lengkap,status) VALUES (?,?,\'teknisi\',?,?,\'aktif\')', [username, hash, region, nama]);
        userId = user.insertId;
      }
      const [created] = await connection.query('INSERT INTO technicians (user_id,nama,nomor_whatsapp,wilayah_tugas,status) VALUES (?,?,?,?,\'tersedia\')', [userId, nama, phone, region]);
      await connection.commit();
      return res.status(201).json({ success: true, data: { id: created.insertId, nama, wilayah_tugas: region, status: 'tersedia', user_id: userId } });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Username sudah digunakan.' });
    return next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = Number(req.params.id); const nama = String(req.body.nama || '').trim(); const phone = String(req.body.nomor_whatsapp || '').trim();
    const region = String(req.body.wilayah_tugas || '').toUpperCase(); const status = String(req.body.status || '');
    if (!nama || !phone || !WILAYAH_RESMI.includes(region) || !['tersedia', 'bertugas', 'off'].includes(status)) return res.status(400).json({ success: false, message: 'Data teknisi tidak valid.' });
    if (isDemo()) {
      const technician = demo.technicians.find((item) => item.id === id);
      if (!technician) return res.status(404).json({ success: false, message: 'Teknisi tidak ditemukan.' });
      if (demo.complaints.some((item) => item.teknisi_id === id && !['closed', 'ditolak'].includes(item.status)) && technician.wilayah_tugas !== region) return res.status(409).json({ success: false, message: 'Wilayah teknisi tidak dapat diganti saat masih memiliki tugas aktif.' });
      Object.assign(technician, { nama, nomor_whatsapp: phone, wilayah_tugas: region, status });
      const user = demo.users.find((item) => item.id === technician.user_id);
      if (user) Object.assign(user, { nama_lengkap: nama, wilayah: region });
      return res.json({ success: true, data: technician });
    }
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [[technician]] = await connection.query('SELECT * FROM technicians WHERE id=? FOR UPDATE', [id]);
      if (!technician) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Teknisi tidak ditemukan.' }); }
      const [[active]] = await connection.query("SELECT COUNT(*) total FROM complaints WHERE teknisi_id=? AND status NOT IN ('closed','ditolak')", [id]);
      if (Number(active.total) && technician.wilayah_tugas !== region) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Wilayah teknisi tidak dapat diganti saat masih memiliki tugas aktif.' }); }
      await connection.query('UPDATE technicians SET nama=?,nomor_whatsapp=?,wilayah_tugas=?,status=? WHERE id=?', [nama, phone, region, status, id]);
      if (technician.user_id) await connection.query('UPDATE users SET nama_lengkap=?,wilayah=? WHERE id=?', [nama, region, technician.user_id]);
      await connection.commit();
      return res.json({ success: true });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  } catch (error) { return next(error); }
};
