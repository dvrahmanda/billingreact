const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { demo, isDemo, normalize } = require('../utils/helpers');
const { WILAYAH_RESMI } = require('../config/constants');

exports.list = async (req, res, next) => {
  try {
    if (isDemo()) {
      let rows = demo.technicians.map((technician) => {
        const tasks = demo.complaints.filter((item) => item.teknisi_id === technician.id
          && normalize(demo.customers.find((customer) => customer.id === item.pelanggan_id)?.alamat) === normalize(technician.wilayah_tugas));
        const active = tasks.filter((item) => !['closed', 'ditolak', 'penanganan_selesai'].includes(item.status));
        const customer = active[0] && demo.customers.find((item) => item.id === active[0].pelanggan_id);
        return { ...technician, active_jobs: active.length,
          completed_jobs: tasks.filter((item) => ['penanganan_selesai', 'closed'].includes(item.status)).length,
          current_customer: customer?.nama || null };
      });
      if (req.wilayahScope !== 'all') rows = rows.filter((item) => normalize(item.wilayah_tugas) === normalize(req.wilayahScope));
      return res.json({ success: true, data: rows });
    }
    const params = []; let where = '';
    if (req.wilayahScope !== 'all') { where = 'WHERE t.wilayah_tugas=?'; params.push(req.wilayahScope); }
    const [rows] = await db.query(
      `SELECT t.*,l.latitude,l.longitude,l.accuracy_m, l.recorded_at location_updated_at,
       (SELECT COUNT(*) FROM complaints c JOIN pelanggan_salam p ON p.id=c.pelanggan_id
        WHERE c.teknisi_id=t.id AND p.alamat=t.wilayah_tugas AND c.status NOT IN ('closed','ditolak','penanganan_selesai')) active_jobs,
       (SELECT COUNT(*) FROM complaints c JOIN pelanggan_salam p ON p.id=c.pelanggan_id
        WHERE c.teknisi_id=t.id AND p.alamat=t.wilayah_tugas AND c.status IN ('penanganan_selesai','closed')) completed_jobs,
       (SELECT p.nama FROM complaints c JOIN pelanggan_salam p ON p.id=c.pelanggan_id
        WHERE c.teknisi_id=t.id AND p.alamat=t.wilayah_tugas AND c.status NOT IN ('closed','ditolak','penanganan_selesai') ORDER BY c.updated_at DESC,c.id DESC LIMIT 1) current_customer
       FROM technicians t LEFT JOIN technician_locations l ON l.technician_id=t.id ${where} ORDER BY t.wilayah_tugas,t.nama`, params,
    );
    return res.json({ success: true, data: rows });
  } catch (error) { return next(error); }
};

exports.monitoring = async (req, res, next) => {
  try {
    const technicianId = Number(req.params.id);
    if (!Number.isSafeInteger(technicianId) || technicianId < 1) return res.status(404).json({ success: false, message: 'Teknisi tidak ditemukan.' });
    const scope = req.wilayahScope;
    if (isDemo()) {
      const technician = demo.technicians.find((item) => item.id === technicianId
        && (scope === 'all' || normalize(item.wilayah_tugas) === normalize(scope)));
      if (!technician) return res.status(404).json({ success: false, message: 'Teknisi tidak ditemukan.' });
      const assignedComplaints = demo.complaints.filter((item) => item.teknisi_id === technicianId).filter((item) => {
        const customer = demo.customers.find((row) => row.id === item.pelanggan_id);
        return scope === 'all' || normalize(customer?.alamat) === normalize(scope);
      });
      const tasks = assignedComplaints.map((item) => {
        const customer = demo.customers.find((row) => row.id === item.pelanggan_id) || {};
        return { id: item.id, nomor_tiket: item.nomor_tiket, kategori: item.kategori, status: item.status,
          nama_pelanggan: customer.nama, wilayah: customer.alamat, updated_at: item.updated_at || item.created_at };
      });
      const activity = assignedComplaints.flatMap((item) => {
        const customer = demo.customers.find((row) => row.id === item.pelanggan_id) || {};
        return (item.timeline || []).map((event, index) => ({ ...event, id: `${item.id}-${index}`, complaint_id: item.id,
          nomor_tiket: item.nomor_tiket, status_tiket: item.status, nama_pelanggan: customer.nama, wilayah: customer.alamat }));
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50);
      return res.json({ success: true, data: { technician, tasks, activity } });
    }

    const locationRegionFilter = scope === 'all' ? '' : ' AND t.wilayah_tugas=?';
    const locationParams = scope === 'all' ? [technicianId] : [technicianId, scope];
    const [[technician]] = await db.query(
      `SELECT t.id,t.nama,t.nomor_whatsapp,t.wilayah_tugas,t.status,l.latitude,l.longitude,l.accuracy_m,
       l.recorded_at location_updated_at FROM technicians t LEFT JOIN technician_locations l ON l.technician_id=t.id
       WHERE t.id=?${locationRegionFilter} LIMIT 1`, locationParams,
    );
    if (!technician) return res.status(404).json({ success: false, message: 'Teknisi tidak ditemukan.' });

    const taskRegionFilter = scope === 'all' ? '' : ' AND p.alamat=?';
    const taskParams = scope === 'all' ? [technicianId] : [technicianId, scope];
    const [tasks] = await db.query(
      `SELECT c.id,c.nomor_tiket,c.kategori,c.status,c.created_at,c.updated_at,p.nama nama_pelanggan,p.alamat wilayah
       FROM complaints c JOIN pelanggan_salam p ON p.id=c.pelanggan_id WHERE c.teknisi_id=?${taskRegionFilter}
       ORDER BY c.updated_at DESC,c.id DESC LIMIT 50`, taskParams,
    );
    const activityParams = scope === 'all' ? [technicianId] : [technicianId, scope];
    const activityRegionFilter = scope === 'all' ? '' : ' AND p.alamat=?';
    const [activity] = await db.query(
      `SELECT ct.id,ct.complaint_id,ct.status,ct.judul,ct.keterangan,ct.aktor_nama,ct.created_at,
       c.nomor_tiket,c.status status_tiket,p.nama nama_pelanggan,p.alamat wilayah
       FROM complaint_timelines ct JOIN complaints c ON c.id=ct.complaint_id JOIN pelanggan_salam p ON p.id=c.pelanggan_id
       WHERE c.teknisi_id=?${activityRegionFilter} ORDER BY ct.created_at DESC,ct.id DESC LIMIT 50`, activityParams,
    );
    return res.json({ success: true, data: { technician, tasks, activity } });
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
