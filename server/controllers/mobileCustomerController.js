const path = require('node:path');
const crypto = require('node:crypto');
const db = require('../config/database');
const { demo, isDemo } = require('../utils/helpers');
const { notifyAdmins, sendWhatsApp } = require('../services/notificationService');
const { todayJakarta } = require('../utils/dates');

const complaintCategories = new Set(['internet_mati', 'internet_lambat', 'perangkat', 'kabel_putus', 'lainnya']);
const ticketNumber = () => `CMP-${todayJakarta().slice(0, 7).replace('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

async function customerData(customerId) {
  if (isDemo()) return demo.customers.find((item) => item.id === Number(customerId));
  const [[customer]] = await db.query(
    `SELECT p.*,d.nama_ktp,d.nik,d.foto_rumah,d.koordinat_x,d.koordinat_y,d.pppoe_user,d.catatan
     FROM pelanggan_salam p LEFT JOIN pelanggan_detail_salam d ON d.pelanggan_id=p.id WHERE p.id=?`, [customerId],
  );
  return customer;
}

exports.dashboard = async (req, res, next) => {
  try {
    const customerId = Number(req.user.pelanggan_id);
    const customer = await customerData(customerId);
    if (!customer) return res.status(404).json({ success: false, message: 'Data pelanggan tidak ditemukan.' });
    if (isDemo()) {
      const bills = demo.bills.filter((item) => item.pelanggan_id === customerId).sort((a, b) => b.periode.localeCompare(a.periode));
      const unpaid = bills.filter((item) => item.status_bayar !== 'Lunas');
      return res.json({ success: true, data: { customer: { id: customer.id, id_pelanggan: customer.id_pelanggan, nama: customer.nama, wilayah: customer.alamat }, current_bill: bills[0] || null, unpaid_bills: unpaid, total_tunggakan: unpaid.reduce((sum, item) => sum + Number(item.nominal_tagihan), 0), recent_payments: demo.payments.filter((item) => item.pelanggan_id === customerId).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5), recent_complaints: demo.complaints.filter((item) => item.pelanggan_id === customerId).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5) } });
    }
    const [bills] = await db.query('SELECT * FROM tagihan_salam WHERE pelanggan_id=? ORDER BY periode DESC', [customerId]);
    const [payments] = await db.query('SELECT * FROM payments WHERE pelanggan_id=? ORDER BY created_at DESC LIMIT 5', [customerId]);
    const [complaints] = await db.query('SELECT id,nomor_tiket,kategori,status,created_at FROM complaints WHERE pelanggan_id=? ORDER BY created_at DESC LIMIT 5', [customerId]);
    const unpaid = bills.filter((item) => item.status_bayar !== 'Lunas');
    return res.json({ success: true, data: { customer: { id: customer.id, id_pelanggan: customer.id_pelanggan, nama: customer.nama, wilayah: customer.alamat }, current_bill: bills[0] || null, unpaid_bills: unpaid, total_tunggakan: unpaid.reduce((sum, item) => sum + Number(item.nominal_tagihan), 0), recent_payments: payments, recent_complaints: complaints } });
  } catch (error) { return next(error); }
};

exports.bills = async (req, res, next) => {
  try {
    const customerId = Number(req.user.pelanggan_id);
    const rows = isDemo() ? demo.bills.filter((item) => item.pelanggan_id === customerId).sort((a, b) => b.periode.localeCompare(a.periode))
      : (await db.query('SELECT * FROM tagihan_salam WHERE pelanggan_id=? ORDER BY periode DESC', [customerId]))[0];
    return res.json({ success: true, data: rows });
  } catch (error) { return next(error); }
};

exports.billDetail = async (req, res, next) => {
  try {
    const customerId = Number(req.user.pelanggan_id); const id = Number(req.params.id);
    if (isDemo()) {
      const bill = demo.bills.find((item) => item.id === id && item.pelanggan_id === customerId);
      if (!bill) return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan.' });
      return res.json({ success: true, data: { ...bill, payments: demo.payments.filter((item) => item.tagihan_id === id && item.pelanggan_id === customerId) } });
    }
    const [[bill]] = await db.query('SELECT * FROM tagihan_salam WHERE id=? AND pelanggan_id=?', [id, customerId]);
    if (!bill) return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan.' });
    const [payments] = await db.query('SELECT * FROM payments WHERE tagihan_id=? AND pelanggan_id=? ORDER BY created_at DESC', [id, customerId]);
    return res.json({ success: true, data: { ...bill, payments } });
  } catch (error) { return next(error); }
};

exports.payments = async (req, res, next) => {
  try {
    const rows = isDemo() ? demo.payments.filter((item) => item.pelanggan_id === Number(req.user.pelanggan_id)).sort((a, b) => b.created_at.localeCompare(a.created_at))
      : (await db.query('SELECT * FROM payments WHERE pelanggan_id=? ORDER BY created_at DESC LIMIT 500', [req.user.pelanggan_id]))[0];
    return res.json({ success: true, data: rows });
  } catch (error) { return next(error); }
};

exports.paymentInfo = async (req, res, next) => {
  try {
    const customerId = Number(req.user.pelanggan_id);
    if (isDemo()) {
      const customer = demo.customers.find((item) => item.id === customerId);
      if (!customer) return res.status(404).json({ success: false, message: 'Data pelanggan tidak ditemukan.' });
      const config = (demo.regionConfigs || []).find((item) => item.wilayah === customer.alamat);
      return res.json({ success: true, data: config || { wilayah: customer.alamat, nama_layanan: `Life Media ${customer.alamat}`, nomor_whatsapp: '', catatan_pembayaran: '', metode_pembayaran: [] } });
    }
    const [[customer]] = await db.query('SELECT alamat FROM pelanggan_salam WHERE id=?', [customerId]);
    if (!customer) return res.status(404).json({ success: false, message: 'Data pelanggan tidak ditemukan.' });
    const [[config]] = await db.query('SELECT id,wilayah,nama_layanan,nomor_whatsapp,catatan_pembayaran FROM wilayah_configs WHERE wilayah=?', [customer.alamat]);
    if (!config) return res.json({ success: true, data: { wilayah: customer.alamat, nama_layanan: `Life Media ${customer.alamat}`, nomor_whatsapp: '', catatan_pembayaran: '', metode_pembayaran: [] } });
    const [methods] = await db.query('SELECT jenis,nama,nomor,atas_nama FROM wilayah_payment_methods WHERE wilayah_config_id=? ORDER BY id', [config.id]);
    const { id, ...data } = config;
    return res.json({ success: true, data: { ...data, metode_pembayaran: methods } });
  } catch (error) { return next(error); }
};

exports.complaints = async (req, res, next) => {
  try {
    const customerId = Number(req.user.pelanggan_id);
    if (isDemo()) return res.json({ success: true, data: demo.complaints.filter((item) => item.pelanggan_id === customerId).sort((a, b) => b.created_at.localeCompare(a.created_at)) });
    const [rows] = await db.query('SELECT id,nomor_tiket,pelanggan_id,kategori,deskripsi,foto_kendala,status,teknisi_id,created_at,updated_at FROM complaints WHERE pelanggan_id=? ORDER BY created_at DESC', [customerId]);
    return res.json({ success: true, data: rows });
  } catch (error) { return next(error); }
};

exports.complaintDetail = async (req, res, next) => {
  try {
    const id = Number(req.params.id); const customerId = Number(req.user.pelanggan_id);
    if (isDemo()) {
      const item = demo.complaints.find((row) => row.id === id && row.pelanggan_id === customerId);
      if (!item) return res.status(404).json({ success: false, message: 'Complain tidak ditemukan.' });
      const technician = demo.technicians.find((row) => row.id === item.teknisi_id);
      return res.json({ success: true, data: { ...item, teknisi_nama: technician?.nama, teknisi_nomor_whatsapp: technician?.nomor_whatsapp } });
    }
    const [[item]] = await db.query(
      `SELECT c.*,t.nama teknisi_nama,t.nomor_whatsapp teknisi_nomor_whatsapp FROM complaints c LEFT JOIN technicians t ON t.id=c.teknisi_id WHERE c.id=? AND c.pelanggan_id=?`, [id, customerId],
    );
    if (!item) return res.status(404).json({ success: false, message: 'Complain tidak ditemukan.' });
    const [timeline] = await db.query('SELECT status,judul,keterangan,aktor_nama,created_at FROM complaint_timelines WHERE complaint_id=? ORDER BY created_at,id', [id]);
    return res.json({ success: true, data: { ...item, timeline } });
  } catch (error) { return next(error); }
};

exports.createComplaint = async (req, res, next) => {
  try {
    const category = String(req.body.kategori || '');
    const description = String(req.body.deskripsi || '').trim();
    if (!complaintCategories.has(category) || description.length < 10) return res.status(400).json({ success: false, message: 'Pilih kategori dan isi deskripsi minimal 10 karakter.' });
    const customerId = Number(req.user.pelanggan_id);
    const number = ticketNumber();
    const photoPath = req.file ? `/uploads/foto_complain/${path.basename(req.file.path)}` : null;
    if (isDemo()) {
      const customer = demo.customers.find((item) => item.id === customerId);
      if (!customer) return res.status(404).json({ success: false, message: 'Data pelanggan tidak ditemukan.' });
      const item = { id: Math.max(0, ...demo.complaints.map((row) => row.id)) + 1, nomor_tiket: number, pelanggan_id: customerId, kategori: category, deskripsi: description, foto_kendala: photoPath, status: 'menunggu_verifikasi', teknisi_id: null, pppoe_user_snapshot: customer.pppoe_user || null, created_at: new Date().toISOString(), timeline: [{ status: 'menunggu_verifikasi', judul: 'Complain dibuat', keterangan: description, aktor_nama: customer.nama, created_at: new Date().toISOString() }] };
      demo.complaints.push(item);
      await notifyAdmins(customer.alamat, { jenis: 'complain', judul: 'Complain baru', pesan: `${customer.nama} membuat tiket ${number}.`, tautan: `/complaints/${item.id}` });
      return res.status(201).json({ success: true, data: item });
    }
    const customer = await customerData(customerId);
    if (!customer) return res.status(404).json({ success: false, message: 'Data pelanggan tidak ditemukan.' });
    const connection = await db.getConnection(); let complaintId;
    try {
      await connection.beginTransaction();
      const [created] = await connection.query(
        `INSERT INTO complaints (nomor_tiket,pelanggan_id,kategori,deskripsi,foto_kendala,status,pppoe_user_snapshot) VALUES (?,?,?,?,?,'menunggu_verifikasi',?)`,
        [number, customerId, category, description, photoPath, customer.pppoe_user || null],
      );
      complaintId = created.insertId;
      await connection.query('INSERT INTO complaint_timelines (complaint_id,status,judul,keterangan,aktor_id,aktor_nama) VALUES (?,\'menunggu_verifikasi\',\'Complain dibuat\',?,?,?)', [complaintId, description, req.user.id, customer.nama]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    await notifyAdmins(customer.alamat, { jenis: 'complain', judul: 'Complain baru', pesan: `${customer.nama} membuat tiket ${number}.`, tautan: `/complaints/${complaintId}` });
    return res.status(201).json({ success: true, data: { id: complaintId, nomor_tiket: number, status: 'menunggu_verifikasi' } });
  } catch (error) { return next(error); }
};
