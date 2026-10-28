const db = require('../config/database');
const { demo, isDemo, normalize, pagination } = require('../utils/helpers');
const { rowAllowed } = require('../middleware/roleScope');
const { notifyAdmins, notifyCustomer, notifyTechnician, sendWhatsApp } = require('../services/notificationService');

function demoJoined(complaint) {
  const customer = demo.customers.find((item) => item.id === complaint.pelanggan_id) || {};
  const technician = demo.technicians.find((item) => item.id === complaint.teknisi_id);
  return { ...complaint, nama: customer.nama, id_pelanggan: customer.id_pelanggan, nomor_pelanggan: customer.nomor_pelanggan,
    alamat: customer.alamat, alamat_lengkap: customer.alamat_lengkap || customer.alamat, koordinat_x: customer.koordinat_x,
    koordinat_y: customer.koordinat_y, pppoe_user: complaint.pppoe_user_snapshot || customer.pppoe_user,
    pppoe_status: customer.pppoe_status, teknisi_nama: technician?.nama || null, teknisi_nomor_whatsapp: technician?.nomor_whatsapp || null };
}

function scopeRows(req, rows) {
  const region = req.user.role === 'superadmin' ? req.wilayahScope : req.user.wilayah;
  return region && region !== 'all' ? rows.filter((item) => normalize(item.alamat) === normalize(region)) : rows;
}

async function loadComplaint(id, connection = db) {
  const [[row]] = await connection.query(
    `SELECT c.*,p.nama,p.id_pelanggan,p.nomor_pelanggan,p.alamat,p.alamat_lengkap,d.pppoe_user,d.koordinat_x,d.koordinat_y,
     t.nama teknisi_nama,t.nomor_whatsapp teknisi_nomor_whatsapp
     FROM complaints c JOIN pelanggan_salam p ON p.id=c.pelanggan_id
     LEFT JOIN pelanggan_detail_salam d ON d.pelanggan_id=p.id LEFT JOIN technicians t ON t.id=c.teknisi_id WHERE c.id=?`, [id],
  );
  return row;
}

async function addTimeline(connection, complaintId, status, title, description, user) {
  await connection.query(
    'INSERT INTO complaint_timelines (complaint_id,status,judul,keterangan,aktor_id,aktor_nama) VALUES (?,?,?,?,?,?)',
    [complaintId, status, title, description || null, user.id || null, user.nama_lengkap || user.username || 'Sistem'],
  );
}

exports.list = async (req, res, next) => {
  try {
    if (isDemo()) {
      let rows = scopeRows(req, demo.complaints.map(demoJoined));
      if (req.query.status) rows = rows.filter((item) => item.status === req.query.status);
      if (req.query.date_from) rows = rows.filter((item) => item.created_at >= req.query.date_from);
      if (req.query.date_to) rows = rows.filter((item) => item.created_at.slice(0, 10) <= req.query.date_to);
      const { page, pageSize, offset } = pagination(req);
      return res.json({ success: true, data: rows.slice(offset, offset + pageSize), pagination: { page, page_size: pageSize, total: rows.length, pages: Math.ceil(rows.length / pageSize) } });
    }
    const clauses = [];
    const params = [];
    const region = req.user.role === 'superadmin' ? req.wilayahScope : req.user.wilayah;
    if (region && region !== 'all') { clauses.push('p.alamat=?'); params.push(region); }
    if (req.query.status) { clauses.push('c.status=?'); params.push(req.query.status); }
    if (req.query.date_from) { clauses.push('c.created_at>=?'); params.push(`${req.query.date_from} 00:00:00`); }
    if (req.query.date_to) { clauses.push('c.created_at<=?'); params.push(`${req.query.date_to} 23:59:59`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { page, pageSize, offset } = pagination(req);
    const [[count]] = await db.query(`SELECT COUNT(*) total FROM complaints c JOIN pelanggan_salam p ON p.id=c.pelanggan_id ${where}`, params);
    const [rows] = await db.query(
      `SELECT c.*,p.nama,p.id_pelanggan,p.alamat,p.alamat_lengkap,t.nama teknisi_nama FROM complaints c JOIN pelanggan_salam p ON p.id=c.pelanggan_id
       LEFT JOIN technicians t ON t.id=c.teknisi_id ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset],
    );
    return res.json({ success: true, data: rows, pagination: { page, page_size: pageSize, total: Number(count.total), pages: Math.ceil(Number(count.total) / pageSize) } });
  } catch (error) { return next(error); }
};

exports.detail = async (req, res, next) => {
  try {
    if (isDemo()) {
      const item = demo.complaints.find((row) => row.id === Number(req.params.id));
      if (!item) return res.status(404).json({ success: false, message: 'Complain tidak ditemukan.' });
      const complaint = demoJoined(item);
      if (!rowAllowed(req, complaint.alamat)) return res.status(404).json({ success: false, message: 'Complain tidak ditemukan.' });
      return res.json({ success: true, data: complaint });
    }
    const complaint = await loadComplaint(req.params.id);
    if (!complaint || !rowAllowed(req, complaint.alamat)) return res.status(404).json({ success: false, message: 'Complain tidak ditemukan.' });
    const [timeline] = await db.query('SELECT * FROM complaint_timelines WHERE complaint_id=? ORDER BY created_at,id', [complaint.id]);
    return res.json({ success: true, data: { ...complaint, timeline } });
  } catch (error) { return next(error); }
};

exports.verify = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const action = String(req.body.action || '');
    const reason = String(req.body.alasan || '').trim();
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ success: false, message: 'Aksi harus approve atau reject.' });
    if (action === 'reject' && !reason) return res.status(400).json({ success: false, message: 'Alasan penolakan wajib diisi.' });
    if (isDemo()) {
      const complaint = demo.complaints.find((item) => item.id === id);
      if (!complaint) return res.status(404).json({ success: false, message: 'Complain tidak ditemukan.' });
      const joined = demoJoined(complaint);
      if (!rowAllowed(req, joined.alamat)) return res.status(404).json({ success: false, message: 'Complain tidak ditemukan.' });
      if (complaint.status !== 'menunggu_verifikasi') return res.status(409).json({ success: false, message: 'Complain sudah melewati tahap verifikasi.' });
      const status = action === 'approve' ? 'terverifikasi' : 'ditolak';
      complaint.status = status; complaint.alasan_penolakan = action === 'reject' ? reason : null;
      complaint.timeline.push({ status, judul: action === 'approve' ? 'Complain diverifikasi' : 'Complain ditolak', keterangan: action === 'approve' ? 'Laporan dinyatakan valid.' : reason, aktor_nama: req.user.nama_lengkap || req.user.username, created_at: new Date().toISOString() });
      await notifyCustomer(complaint.pelanggan_id, { jenis: 'complain', judul: action === 'approve' ? 'Complain diterima' : 'Complain ditolak', pesan: action === 'approve' ? `Tiket ${complaint.nomor_tiket} telah diverifikasi.` : `Tiket ${complaint.nomor_tiket} ditolak: ${reason}`, tautan: `/complaints/${id}` });
      return res.json({ success: true, data: complaint });
    }
    const connection = await db.getConnection();
    let complaint;
    try {
      await connection.beginTransaction();
      complaint = await loadComplaint(id, connection);
      if (!complaint || !rowAllowed(req, complaint.alamat)) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Complain tidak ditemukan.' }); }
      if (complaint.status !== 'menunggu_verifikasi') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Complain sudah melewati tahap verifikasi.' }); }
      const status = action === 'approve' ? 'terverifikasi' : 'ditolak';
      await connection.query('UPDATE complaints SET status=?,alasan_penolakan=?,diverifikasi_oleh=?,diverifikasi_pada=NOW() WHERE id=?', [status, action === 'reject' ? reason : null, req.user.id, id]);
      await addTimeline(connection, id, status, action === 'approve' ? 'Complain diverifikasi' : 'Complain ditolak', action === 'approve' ? 'Laporan dinyatakan valid.' : reason, req.user);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    await notifyCustomer(complaint.pelanggan_id, { jenis: 'complain', judul: action === 'approve' ? 'Complain diterima' : 'Complain ditolak', pesan: action === 'approve' ? `Tiket ${complaint.nomor_tiket} telah diverifikasi.` : `Tiket ${complaint.nomor_tiket} ditolak: ${reason}`, tautan: `/complaints/${id}` });
    if (action === 'reject') await sendWhatsApp(complaint.nomor_pelanggan, `Complain ${complaint.nomor_tiket} ditolak. Alasan: ${reason}`, { jenis: 'complain', wilayah: complaint.alamat, idPelanggan: complaint.id_pelanggan, dedupeKey: `complaint:${id}:rejected` });
    return res.json({ success: true });
  } catch (error) { return next(error); }
};

exports.assign = async (req, res, next) => {
  try {
    const id = Number(req.params.id); const technicianId = Number(req.body.technician_id);
    if (!Number.isInteger(technicianId)) return res.status(400).json({ success: false, message: 'Teknisi wajib dipilih.' });
    if (isDemo()) {
      const complaint = demo.complaints.find((item) => item.id === id);
      const technician = demo.technicians.find((item) => item.id === technicianId);
      if (!complaint || !technician) return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
      const joined = demoJoined(complaint);
      if (!rowAllowed(req, joined.alamat)) return res.status(404).json({ success: false, message: 'Complain tidak ditemukan.' });
      if (complaint.status !== 'terverifikasi') return res.status(409).json({ success: false, message: 'Complain harus diverifikasi sebelum ditugaskan.' });
      if (normalize(technician.wilayah_tugas) !== normalize(joined.alamat) || technician.status === 'off') return res.status(422).json({ success: false, message: 'Teknisi tidak tersedia untuk wilayah complain ini.' });
      complaint.teknisi_id = technician.id; complaint.status = 'ditugaskan';
      technician.status = 'bertugas'; technician.active_jobs = (technician.active_jobs || 0) + 1; technician.current_customer = joined.nama;
      complaint.timeline.push({ status: 'ditugaskan', judul: 'Teknisi ditugaskan', keterangan: `${technician.nama} menerima penugasan.`, aktor_nama: req.user.nama_lengkap || req.user.username, created_at: new Date().toISOString() });
      await notifyTechnician(technician.id, { jenis: 'teknisi', judul: 'Tugas gangguan baru', pesan: `Tiket ${complaint.nomor_tiket} untuk pelanggan ${joined.nama}.`, tautan: `/mobile/technician/tasks/${id}` });
      await notifyCustomer(complaint.pelanggan_id, { jenis: 'complain', judul: 'Teknisi ditugaskan', pesan: `${technician.nama} ditugaskan untuk tiket ${complaint.nomor_tiket}.`, tautan: `/complaints/${id}` });
      await sendWhatsApp(joined.nomor_pelanggan, `Teknisi ${technician.nama} telah ditugaskan untuk tiket ${complaint.nomor_tiket}.`, { jenis: 'complain', wilayah: joined.alamat, idPelanggan: joined.id_pelanggan, dedupeKey: `complaint:${id}:assigned:${technician.id}` });
      return res.json({ success: true });
    }
    const connection = await db.getConnection();
    let complaint; let technician;
    try {
      await connection.beginTransaction();
      complaint = await loadComplaint(id, connection);
      if (!complaint || !rowAllowed(req, complaint.alamat)) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Complain tidak ditemukan.' }); }
      if (complaint.status !== 'terverifikasi') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Complain harus diverifikasi sebelum ditugaskan.' }); }
      [[technician]] = await connection.query('SELECT * FROM technicians WHERE id=? FOR UPDATE', [technicianId]);
      if (!technician || normalize(technician.wilayah_tugas) !== normalize(complaint.alamat) || technician.status === 'off') { await connection.rollback(); return res.status(422).json({ success: false, message: 'Teknisi tidak tersedia untuk wilayah complain ini.' }); }
      await connection.query("UPDATE complaints SET teknisi_id=?,status='ditugaskan' WHERE id=?", [technicianId, id]);
      await connection.query("UPDATE technicians SET status='bertugas' WHERE id=?", [technicianId]);
      await addTimeline(connection, id, 'ditugaskan', 'Teknisi ditugaskan', `${technician.nama} menerima penugasan.`, req.user);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    await notifyTechnician(technicianId, { jenis: 'teknisi', judul: 'Tugas gangguan baru', pesan: `Tiket ${complaint.nomor_tiket} untuk pelanggan ${complaint.nama}.`, tautan: `/mobile/technician/tasks/${id}` });
    await notifyCustomer(complaint.pelanggan_id, { jenis: 'complain', judul: 'Teknisi ditugaskan', pesan: `${technician.nama} ditugaskan untuk tiket ${complaint.nomor_tiket}.`, tautan: `/complaints/${id}` });
    await sendWhatsApp(complaint.nomor_pelanggan, `Teknisi ${technician.nama} telah ditugaskan untuk tiket ${complaint.nomor_tiket}.`, { jenis: 'complain', wilayah: complaint.alamat, idPelanggan: complaint.id_pelanggan, dedupeKey: `complaint:${id}:assigned:${technicianId}` });
    return res.json({ success: true });
  } catch (error) { return next(error); }
};

exports.close = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isDemo()) {
      const complaint = demo.complaints.find((item) => item.id === id);
      if (!complaint) return res.status(404).json({ success: false, message: 'Complain tidak ditemukan.' });
      const joined = demoJoined(complaint);
      if (!rowAllowed(req, joined.alamat)) return res.status(404).json({ success: false, message: 'Complain tidak ditemukan.' });
      if (complaint.status !== 'penanganan_selesai') return res.status(409).json({ success: false, message: 'Complain hanya dapat ditutup setelah penanganan selesai.' });
      complaint.status = 'closed'; complaint.closed_by = req.user.id; complaint.closed_at = new Date().toISOString();
      complaint.timeline.push({ status: 'closed', judul: 'Complain ditutup', keterangan: 'Hasil penanganan telah diverifikasi Admin.', aktor_nama: req.user.nama_lengkap || req.user.username, created_at: complaint.closed_at });
      const technician = demo.technicians.find((item) => item.id === complaint.teknisi_id);
      if (technician) { technician.active_jobs = Math.max(0, (technician.active_jobs || 1) - 1); technician.completed_jobs = (technician.completed_jobs || 0) + 1; if (!technician.active_jobs) technician.status = 'tersedia'; }
      await notifyCustomer(complaint.pelanggan_id, { jenis: 'complain', judul: 'Complain selesai', pesan: `Tiket ${complaint.nomor_tiket} telah ditutup.`, tautan: `/complaints/${id}` });
      return res.json({ success: true });
    }
    const connection = await db.getConnection(); let complaint;
    try {
      await connection.beginTransaction();
      complaint = await loadComplaint(id, connection);
      if (!complaint || !rowAllowed(req, complaint.alamat)) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Complain tidak ditemukan.' }); }
      if (complaint.status !== 'penanganan_selesai') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Complain hanya dapat ditutup setelah penanganan selesai.' }); }
      await connection.query("UPDATE complaints SET status='closed',ditutup_oleh=?,ditutup_pada=NOW() WHERE id=?", [req.user.id, id]);
      await addTimeline(connection, id, 'closed', 'Complain ditutup', 'Hasil penanganan telah diverifikasi Admin.', req.user);
      if (complaint.teknisi_id) {
        const [[active]] = await connection.query("SELECT COUNT(*) total FROM complaints WHERE teknisi_id=? AND id<>? AND status NOT IN ('closed','ditolak')", [complaint.teknisi_id, id]);
        await connection.query('UPDATE technicians SET status=? WHERE id=?', [Number(active.total) ? 'bertugas' : 'tersedia', complaint.teknisi_id]);
      }
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    await notifyCustomer(complaint.pelanggan_id, { jenis: 'complain', judul: 'Complain selesai', pesan: `Tiket ${complaint.nomor_tiket} telah ditutup.`, tautan: `/complaints/${id}` });
    await sendWhatsApp(complaint.nomor_pelanggan, `Tiket ${complaint.nomor_tiket} telah ditutup setelah hasil penanganan diverifikasi.`, { jenis: 'complain', wilayah: complaint.alamat, idPelanggan: complaint.id_pelanggan, dedupeKey: `complaint:${id}:closed` });
    return res.json({ success: true });
  } catch (error) { return next(error); }
};
