const axios = require('axios');
const db = require('../config/database');
const { demo, isDemo } = require('../utils/helpers');

async function createNotification(userId, payload) {
  if (!userId) return null;
  const notification = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    user_id: userId,
    wilayah: payload.wilayah || null,
    jenis: payload.jenis || 'sistem',
    judul: payload.judul,
    pesan: payload.pesan,
    tautan: payload.tautan || null,
    dibaca_pada: null,
    created_at: new Date().toISOString(),
  };
  if (isDemo()) {
    demo.notifications.unshift(notification);
    return notification;
  }
  const [result] = await db.query(
    'INSERT INTO user_notifications (user_id,wilayah,jenis,judul,pesan,tautan) VALUES (?,?,?,?,?,?)',
    [userId, notification.wilayah, notification.jenis, notification.judul, notification.pesan, notification.tautan],
  );
  return { ...notification, id: result.insertId };
}

async function notifyAdmins(wilayah, payload) {
  if (isDemo()) {
    const recipients = demo.users.filter((user) => user.role === 'superadmin' || user.role === 'admin');
    for (const user of recipients) await createNotification(user.id, { ...payload, wilayah });
    return;
  }
  const [users] = await db.query(
    "SELECT id FROM users WHERE status='aktif' AND role IN ('superadmin','admin')",
  );
  await Promise.all(users.map((user) => createNotification(user.id, { ...payload, wilayah })));
}

async function notifyCustomer(customerId, payload) {
  if (isDemo()) {
    const customer = demo.customers.find((item) => item.id === Number(customerId));
    if (customer?.user_id) await createNotification(customer.user_id, { ...payload, wilayah: customer.alamat });
    return;
  }
  const [[customer]] = await db.query('SELECT user_id,alamat FROM pelanggan_salam WHERE id=?', [customerId]);
  if (customer?.user_id) await createNotification(customer.user_id, { ...payload, wilayah: customer.alamat });
}

async function notifyTechnician(technicianId, payload) {
  if (isDemo()) {
    const technician = demo.technicians.find((item) => item.id === Number(technicianId));
    if (technician?.user_id) await createNotification(technician.user_id, { ...payload, wilayah: technician.wilayah_tugas });
    return;
  }
  const [[technician]] = await db.query('SELECT user_id,wilayah_tugas FROM technicians WHERE id=?', [technicianId]);
  if (technician?.user_id) await createNotification(technician.user_id, { ...payload, wilayah: technician.wilayah_tugas });
}

async function sendWhatsApp(target, message, options = {}) {
  const key = options.dedupeKey || `wa:${options.jenis || 'message'}:${target}:${Date.now()}`;
  if (isDemo()) {
    if (demo.whatsappDedupe.has(key)) return { sent: false, duplicate: true };
    demo.whatsappDedupe.add(key);
    demo.messageLogs.push({ target, message, jenis: options.jenis, status: 'gagal', response_gateway: 'DEMO_MODE: gateway tidak dipanggil', created_at: new Date().toISOString() });
    return { sent: false, demo: true };
  }

  const connection = await db.getConnection();
  try {
    const [claim] = await connection.query('INSERT IGNORE INTO notification_delivery_keys (dedupe_key,status) VALUES (?,\'attempted\')', [key]);
    if (!claim.affectedRows) return { sent: false, duplicate: true };
    let status = 'gagal';
    let response = 'Gateway WhatsApp belum dikonfigurasi.';
    let sent = false;
    if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN && target) {
      try {
        const result = await axios.post(process.env.WHATSAPP_API_URL, { target, message }, {
          headers: { Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}` }, timeout: 10000,
        });
        response = JSON.stringify(result.data).slice(0, 5000);
        status = 'terkirim';
        sent = true;
      } catch (error) {
        response = (error.response?.data ? JSON.stringify(error.response.data) : error.message).slice(0, 5000);
      }
    }
    await connection.query('UPDATE notification_delivery_keys SET status=?,response_gateway=? WHERE dedupe_key=?', [status, response, key]);
    await connection.query(
      'INSERT INTO message_send_log (wilayah,id_pelanggan,target_nomor,message_type,pesan,status,response_gateway) VALUES (?,?,?,?,?,?,?)',
      [options.wilayah || 'SEMUA', options.idPelanggan || null, target || null, options.jenis || 'umum', message, status, response],
    );
    return { sent, status, response };
  } finally {
    connection.release();
  }
}

module.exports = { createNotification, notifyAdmins, notifyCustomer, notifyTechnician, sendWhatsApp };
