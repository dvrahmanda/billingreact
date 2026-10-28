const path = require('node:path');
const fs = require('node:fs');
const db = require('../config/database');
const { demo, isDemo, normalize } = require('../utils/helpers');

const folders = new Set(['bukti_transfer', 'foto_rumah', 'foto_complain', 'foto_penanganan']);
const normalizedPath = (value) => String(value || '').replaceAll('\\', '/').replace(/^\//, '').replace(/^uploads\//, '');

function mayRead(req, region, customerId, technicianId = null) {
  if (req.user.role === 'superadmin') return true;
  if (req.user.role === 'admin') return normalize(req.user.wilayah) === normalize(region);
  if (req.user.role === 'pelanggan') return Number(req.user.pelanggan_id) === Number(customerId);
  if (req.user.role === 'teknisi') return Number(req.user.technician_id) === Number(technicianId);
  return false;
}

exports.read = async (req, res, next) => {
  try {
    const folder = String(req.params.folder || '');
    const filename = path.basename(req.params.filename || '');
    if (!folders.has(folder) || !filename || filename !== req.params.filename) return res.status(404).json({ success: false, message: 'File tidak ditemukan.' });
    const expected = `${folder}/${filename}`;
    let source; let allowed = false;
    if (isDemo()) {
      if (folder === 'bukti_transfer') {
        const payment = demo.payments.find((item) => normalizedPath(item.bukti_transfer) === expected);
        const customer = payment && demo.customers.find((item) => item.id === payment.pelanggan_id);
        allowed = Boolean(customer && mayRead(req, customer.alamat, customer.id));
      } else if (folder === 'foto_rumah') {
        const customer = demo.customers.find((item) => normalizedPath(item.foto_rumah) === expected);
        allowed = Boolean(customer && mayRead(req, customer.alamat, customer.id));
      } else {
        const complaint = demo.complaints.find((item) => normalizedPath(folder === 'foto_complain' ? item.foto_kendala : item.foto_hasil_penanganan) === expected);
        const customer = complaint && demo.customers.find((item) => item.id === complaint.pelanggan_id);
        allowed = Boolean(customer && mayRead(req, customer.alamat, customer.id, complaint.teknisi_id));
      }
    } else if (folder === 'bukti_transfer') {
      const [[row]] = await db.query('SELECT pay.pelanggan_id,c.alamat FROM payments pay JOIN pelanggan_salam c ON c.id=pay.pelanggan_id WHERE pay.bukti_transfer=?', [`/uploads/${expected}`]);
      allowed = Boolean(row && mayRead(req, row.alamat, row.pelanggan_id));
    } else if (folder === 'foto_rumah') {
      const [[row]] = await db.query('SELECT p.id,p.alamat FROM pelanggan_detail_salam d JOIN pelanggan_salam p ON p.id=d.pelanggan_id WHERE d.foto_rumah=?', [`/uploads/${expected}`]);
      allowed = Boolean(row && mayRead(req, row.alamat, row.id));
    } else {
      const column = folder === 'foto_complain' ? 'foto_kendala' : 'foto_hasil_penanganan';
      const [[row]] = await db.query(`SELECT c.teknisi_id,c.pelanggan_id,p.alamat FROM complaints c JOIN pelanggan_salam p ON p.id=c.pelanggan_id WHERE c.${column}=?`, [`/uploads/${expected}`]);
      allowed = Boolean(row && mayRead(req, row.alamat, row.pelanggan_id, row.teknisi_id));
    }
    if (!allowed) return res.status(404).json({ success: false, message: 'File tidak ditemukan.' });
    source = path.resolve(__dirname, '..', 'uploads', folder, filename);
    if (!source.startsWith(path.resolve(__dirname, '..', 'uploads') + path.sep) || !fs.existsSync(source)) return res.status(404).json({ success: false, message: 'File tidak ditemukan.' });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(source);
  } catch (error) { return next(error); }
};
