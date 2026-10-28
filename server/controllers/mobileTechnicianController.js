const path = require('node:path');
const db = require('../config/database');
const { demo, isDemo } = require('../utils/helpers');
const { fetchPPPoE } = require('../services/pppoeProxyService');
const { notifyAdmins, notifyCustomer, sendWhatsApp } = require('../services/notificationService');

const transitions = {
  ditugaskan: new Set(['menuju_lokasi']),
  menuju_lokasi: new Set(['menuju_lokasi', 'dalam_penanganan']),
  dalam_penanganan: new Set(['dalam_penanganan', 'menunggu_material', 'penanganan_selesai']),
  menunggu_material: new Set(['menunggu_material', 'dalam_penanganan']),
};

function demoTask(item) {
  const customer = demo.customers.find((row) => row.id === item.pelanggan_id) || {};
  const technician = demo.technicians.find((row) => row.id === item.teknisi_id);
  return { ...item, nama: customer.nama, nomor_pelanggan: customer.nomor_pelanggan, alamat: customer.alamat,
    alamat_lengkap: customer.alamat_lengkap || customer.alamat, koordinat_x: customer.koordinat_x, koordinat_y: customer.koordinat_y,
    pppoe_user: item.pppoe_user_snapshot || customer.pppoe_user, pppoe_status: customer.pppoe_status,
    teknisi_nama: technician?.nama || null };
}

async function loadTask(id, technicianId, connection = db, lock = false) {
  const [[task]] = await connection.query(
    `SELECT c.*,p.nama,p.id_pelanggan,p.nomor_pelanggan,p.alamat,p.alamat_lengkap,pd.pppoe_user,pd.koordinat_x,pd.koordinat_y,
     t.nama teknisi_nama FROM complaints c JOIN pelanggan_salam p ON p.id=c.pelanggan_id
     LEFT JOIN pelanggan_detail_salam pd ON pd.pelanggan_id=p.id LEFT JOIN technicians t ON t.id=c.teknisi_id
     WHERE c.id=? AND c.teknisi_id=?${lock ? ' FOR UPDATE' : ''}`, [id, technicianId],
  );
  return task;
}

exports.dashboard = async (req, res, next) => {
  try {
    const technicianId = Number(req.user.technician_id);
    if (isDemo()) {
      const tasks = demo.complaints.filter((item) => item.teknisi_id === technicianId).map(demoTask).sort((a, b) => b.created_at.localeCompare(a.created_at));
      return res.json({ success: true, data: { active: tasks.filter((item) => !['closed', 'ditolak'].includes(item.status)), completed: tasks.filter((item) => ['penanganan_selesai', 'closed'].includes(item.status)).length, tasks } });
    }
    const [tasks] = await db.query(
      `SELECT c.*,p.nama,p.id_pelanggan,p.nomor_pelanggan,p.alamat,p.alamat_lengkap FROM complaints c JOIN pelanggan_salam p ON p.id=c.pelanggan_id WHERE c.teknisi_id=? ORDER BY c.created_at DESC LIMIT 500`, [technicianId],
    );
    return res.json({ success: true, data: { active: tasks.filter((item) => !['closed', 'ditolak'].includes(item.status)), completed: tasks.filter((item) => ['penanganan_selesai', 'closed'].includes(item.status)).length, tasks } });
  } catch (error) { return next(error); }
};

exports.taskList = async (req, res, next) => {
  try {
    const technicianId = Number(req.user.technician_id);
    if (isDemo()) return res.json({ success: true, data: demo.complaints.filter((item) => item.teknisi_id === technicianId).map(demoTask).sort((a, b) => b.created_at.localeCompare(a.created_at)) });
    const [rows] = await db.query(
      `SELECT c.id,c.nomor_tiket,c.kategori,c.status,c.created_at,c.updated_at,p.nama,p.id_pelanggan,p.alamat,p.alamat_lengkap FROM complaints c JOIN pelanggan_salam p ON p.id=c.pelanggan_id WHERE c.teknisi_id=? ORDER BY c.created_at DESC`, [technicianId],
    );
    return res.json({ success: true, data: rows });
  } catch (error) { return next(error); }
};

exports.taskDetail = async (req, res, next) => {
  try {
    const technicianId = Number(req.user.technician_id); const id = Number(req.params.id);
    if (isDemo()) {
      const item = demo.complaints.find((row) => row.id === id && row.teknisi_id === technicianId);
      if (!item) return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
      const task = demoTask(item);
      task.timeline = item.timeline || [];
      return res.json({ success: true, data: task });
    }
    const task = await loadTask(id, technicianId);
    if (!task) return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
    const [timeline] = await db.query('SELECT status,judul,keterangan,aktor_nama,created_at FROM complaint_timelines WHERE complaint_id=? ORDER BY created_at,id', [id]);
    const pppoe = task.pppoe_user ? (await fetchPPPoE()).find((item) => item.username === task.pppoe_user) : null;
    return res.json({ success: true, data: { ...task, timeline, pppoe_status: pppoe?.status || null, pppoe_ip: pppoe?.ip || null, pppoe_mac: pppoe?.mac || null, pppoe_router: pppoe?.router || null, pppoe_uptime: pppoe?.uptime || null, pppoe_last_update: pppoe?.last_update || null } });
  } catch (error) { return next(error); }
};

exports.updateTask = async (req, res, next) => {
  try {
    const technicianId = Number(req.user.technician_id); const id = Number(req.params.id);
    const nextStatus = String(req.body.status || '');
    const note = String(req.body.catatan_teknisi || '').trim();
    const cause = String(req.body.penyebab_gangguan || '').trim();
    const action = String(req.body.tindakan_penanganan || '').trim();
    const result = String(req.body.hasil_penanganan || '').trim();
    const photoPath = req.file ? `/uploads/foto_penanganan/${path.basename(req.file.path)}` : null;
    let task;
    if (isDemo()) {
      const item = demo.complaints.find((row) => row.id === id && row.teknisi_id === technicianId);
      if (!item) return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
      if (!transitions[item.status]?.has(nextStatus)) return res.status(409).json({ success: false, message: 'Perubahan status tugas tidak diizinkan.' });
      if (nextStatus === item.status && !note && !cause && !action && !result && !req.file) return res.status(400).json({ success: false, message: 'Tambahkan catatan, penyebab, tindakan, hasil, atau foto untuk mencatat progres.' });
      if (nextStatus === 'penanganan_selesai' && (!result || !action)) return res.status(400).json({ success: false, message: 'Isi tindakan dan hasil penanganan sebelum menyelesaikan tugas.' });
      item.status = nextStatus; item.catatan_teknisi = note || item.catatan_teknisi || null;
      item.penyebab_gangguan = cause || item.penyebab_gangguan || null; item.tindakan_penanganan = action || item.tindakan_penanganan || null;
      item.hasil_penanganan = result || item.hasil_penanganan || null; item.foto_hasil_penanganan = photoPath || item.foto_hasil_penanganan || null;
      item.updated_at = new Date().toISOString();
      const description = [note, cause && `Penyebab: ${cause}`, action && `Tindakan: ${action}`, result && `Hasil: ${result}`, photoPath && `Foto: ${photoPath}`].filter(Boolean).join(' | ');
      item.timeline.push({ status: nextStatus, judul: `Status diperbarui: ${nextStatus.replaceAll('_', ' ')}`, keterangan: description || null, aktor_nama: req.user.nama_lengkap || req.user.username, created_at: item.updated_at });
      task = demoTask(item);
      if (nextStatus === 'penanganan_selesai') {
        const technician = demo.technicians.find((row) => row.id === technicianId);
        if (technician) { technician.active_jobs = Math.max(0, (technician.active_jobs || 1) - 1); technician.status = technician.active_jobs ? 'bertugas' : 'tersedia'; }
      }
    } else {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        task = await loadTask(id, technicianId, connection, true);
        if (!task) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' }); }
        if (!transitions[task.status]?.has(nextStatus)) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Perubahan status tugas tidak diizinkan.' }); }
        if (nextStatus === task.status && !note && !cause && !action && !result && !req.file) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Tambahkan catatan, penyebab, tindakan, hasil, atau foto untuk mencatat progres.' }); }
        if (nextStatus === 'penanganan_selesai' && (!result || !action)) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Isi tindakan dan hasil penanganan sebelum menyelesaikan tugas.' }); }
        const description = [note, cause && `Penyebab: ${cause}`, action && `Tindakan: ${action}`, result && `Hasil: ${result}`, photoPath && `Foto: ${photoPath}`].filter(Boolean).join(' | ');
        await connection.query(
          `UPDATE complaints SET status=?,catatan_teknisi=COALESCE(?,catatan_teknisi),penyebab_gangguan=COALESCE(?,penyebab_gangguan),
           tindakan_penanganan=COALESCE(?,tindakan_penanganan),hasil_penanganan=COALESCE(?,hasil_penanganan),foto_hasil_penanganan=COALESCE(?,foto_hasil_penanganan) WHERE id=? AND teknisi_id=?`,
          [nextStatus, note || null, cause || null, action || null, result || null, photoPath, id, technicianId],
        );
        await connection.query('INSERT INTO complaint_timelines (complaint_id,status,judul,keterangan,aktor_id,aktor_nama) VALUES (?,?,?,?,?,?)', [id, nextStatus, `Status diperbarui: ${nextStatus.replaceAll('_', ' ')}`, description || null, req.user.id, req.user.nama_lengkap || req.user.username]);
        if (nextStatus === 'penanganan_selesai') {
          const [[remaining]] = await connection.query("SELECT COUNT(*) total FROM complaints WHERE teknisi_id=? AND id<>? AND status NOT IN ('closed','ditolak','penanganan_selesai')", [technicianId, id]);
          await connection.query('UPDATE technicians SET status=? WHERE id=?', [Number(remaining.total) ? 'bertugas' : 'tersedia', technicianId]);
        }
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    }

    const title = `Progres complain: ${nextStatus.replaceAll('_', ' ')}`;
    const message = `Tiket ${task.nomor_tiket} diperbarui ke status ${nextStatus.replaceAll('_', ' ')}.${result ? ` Hasil: ${result}` : ''}`;
    await notifyCustomer(task.pelanggan_id, { jenis: 'complain', judul: title, pesan: message, tautan: `/complaints/${id}` });
    await notifyAdmins(task.alamat, { jenis: 'teknisi', judul: title, pesan: `${task.nama}: ${message}`, tautan: `/complaints/${id}` });
    await sendWhatsApp(task.nomor_pelanggan, message, { jenis: 'complain_progres', wilayah: task.alamat, idPelanggan: task.id_pelanggan, dedupeKey: `complaint:${id}:progress:${nextStatus}:${Date.now()}` });
    return res.json({ success: true, data: { id, status: nextStatus } });
  } catch (error) { return next(error); }
};
