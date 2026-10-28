const crypto = require('node:crypto');
const ExcelJS = require('exceljs');
const db = require('../config/database');
const { demo, isDemo, normalize } = require('../utils/helpers');
const { rowAllowed } = require('../middleware/roleScope');
const { createTransactionToken } = require('../services/midtransService');
const { notifyCustomer, notifyAdmins, sendWhatsApp } = require('../services/notificationService');
const { recordActivity } = require('../services/activityService');

function joinedDemo() {
  return demo.payments.map((payment) => {
    const customer = demo.customers.find((item) => item.id === payment.pelanggan_id) || {};
    const bill = demo.bills.find((item) => item.id === payment.tagihan_id) || {};
    return { ...payment, nama: customer.nama, id_pelanggan: customer.id_pelanggan, alamat: customer.alamat, nominal_tagihan: Number(payment.nominal_tagihan || bill.nominal_tagihan || 0), bill_status: bill.status_bayar };
  });
}

function paymentScope(req, rows) {
  if (req.user.role === 'superadmin') {
    const region = req.query.wilayah && !['all', 'semua'].includes(String(req.query.wilayah).toLowerCase()) ? normalize(req.query.wilayah) : null;
    return region ? rows.filter((row) => normalize(row.alamat) === region) : rows;
  }
  return rows.filter((row) => normalize(row.alamat) === normalize(req.user.wilayah));
}

function syncDemoCustomerBill(bill) {
  const customer = demo.customers.find((item) => item.id === bill?.pelanggan_id);
  if (!customer) return;
  const currentPeriod = String(customer.waktu || '').slice(0, 7);
  if (currentPeriod && currentPeriod !== String(bill.periode || '').slice(0, 7)) return;
  Object.assign(customer, { tagihan: bill.nominal_tagihan, status_bayar: bill.status_bayar, tanggal_bayar: bill.tanggal_bayar, nominal_dibayar: bill.nominal_dibayar, nomor_invoice: bill.nomor_invoice });
}

async function syncCustomerBill(connection, billId) {
  await connection.query(
    `UPDATE pelanggan_salam p JOIN tagihan_salam t ON t.pelanggan_id=p.id
     SET p.tagihan=t.nominal_tagihan,p.status_bayar=t.status_bayar,p.tanggal_bayar=t.tanggal_bayar,p.nominal_dibayar=t.nominal_dibayar,p.nomor_invoice=t.nomor_invoice
     WHERE t.id=? AND DATE_FORMAT(p.waktu,'%Y-%m')=DATE_FORMAT(t.periode,'%Y-%m')`, [billId],
  );
}

function paymentResult(payment, duplicate = false) {
  if (duplicate) return 'Transaksi Ganda';
  let gatewayPayload = payment.midtrans_status_response;
  if (typeof gatewayPayload === 'string') { try { gatewayPayload = JSON.parse(gatewayPayload); } catch { gatewayPayload = {}; } }
  const gatewayStatus = String(gatewayPayload?.transaction_status || '').toLowerCase();
  if (['settlement', 'capture'].includes(gatewayStatus) && payment.status !== 'lunas') return 'Transaksi Berhasil, Perlu Diperiksa';
  if (Number(payment.nominal_dibayar) !== Number(payment.nominal_tagihan)) return 'Nominal Tidak Sesuai';
  if (payment.status === 'lunas' && payment.bill_status !== 'Lunas') return 'Transaksi Berhasil, Tagihan Belum Lunas';
  if (payment.status === 'menunggu_verifikasi') return 'Menunggu Verifikasi Manual';
  if (payment.status === 'pending' || payment.status === 'gagal' || payment.status === 'ditolak') return 'Perlu Diperiksa';
  return 'Sesuai';
}

async function markMidtransStatus(orderId, notification) {
  if (isDemo()) {
    const payment = demo.payments.find((item) => item.order_id === orderId);
    if (!payment) return { missing: true };
    const status = String(notification.transaction_status || '').toLowerCase();
    const accepted = status === 'settlement' || (status === 'capture' && String(notification.fraud_status || '').toLowerCase() === 'accept');
    const bill = demo.bills.find((item) => item.id === payment.tagihan_id);
    const transactionId = notification.transaction_id || payment.midtrans_transaction_id;
    const duplicateTransaction = transactionId && demo.payments.some((item) => item.id !== payment.id && item.midtrans_transaction_id === transactionId);
    payment.midtrans_status_response = notification;
    const newlyPaid = accepted && !duplicateTransaction && Number(notification.gross_amount) === Number(payment.nominal_tagihan) && bill && payment.status !== 'lunas';
    if (newlyPaid) {
      payment.status = 'lunas'; payment.metode = notification.payment_type || payment.metode;
      payment.midtrans_transaction_id = transactionId;
      bill.status_bayar = 'Lunas'; bill.tanggal_bayar = new Date().toISOString(); bill.nominal_dibayar = payment.nominal_dibayar; bill.metode_pembayaran = payment.metode || 'Midtrans';
      syncDemoCustomerBill(bill);
    } else if (payment.status === 'lunas') {
      // Keep a successful payment terminal when Midtrans retries or delivers an older event later.
    } else if (duplicateTransaction) payment.status = 'gagal';
    else if (accepted) payment.status = 'gagal';
    else if (status === 'expire') payment.status = 'expired';
    else if (['deny', 'cancel'].includes(status)) payment.status = 'gagal';
    return { payment, customer: demo.customers.find((item) => item.id === payment.pelanggan_id), accepted: payment.status === 'lunas', newlyPaid: Boolean(newlyPaid), duplicate: Boolean(duplicateTransaction) };
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [[payment]] = await connection.query(
      `SELECT pay.*,c.nama,c.nomor_pelanggan,c.id_pelanggan,c.alamat,b.nominal_tagihan bill_amount,b.status_bayar bill_status
       FROM payments pay JOIN pelanggan_salam c ON c.id=pay.pelanggan_id LEFT JOIN tagihan_salam b ON b.id=pay.tagihan_id
       WHERE pay.order_id=? FOR UPDATE`, [orderId],
    );
    if (!payment) { await connection.rollback(); return { missing: true }; }
    const status = String(notification.transaction_status || '').toLowerCase();
    const accepted = status === 'settlement' || (status === 'capture' && String(notification.fraud_status || '').toLowerCase() === 'accept');
    const grossAmount = Number(notification.gross_amount);
    const billAmount = Number(payment.bill_amount || payment.nominal_tagihan);
    let nextStatus = payment.status;
    const transactionId = notification.transaction_id || payment.midtrans_transaction_id;
    let duplicateTransaction = false;
    if (transactionId) {
      const [[other]] = await connection.query('SELECT id FROM payments WHERE midtrans_transaction_id=? AND id<>? LIMIT 1', [transactionId, payment.id]);
      duplicateTransaction = Boolean(other);
    }
    const newlyPaid = accepted && grossAmount === billAmount && !duplicateTransaction && payment.status !== 'lunas';
    if (payment.status === 'lunas') nextStatus = 'lunas';
    else if (duplicateTransaction) nextStatus = 'gagal';
    else if (accepted) nextStatus = grossAmount === billAmount ? 'lunas' : 'gagal';
    else if (status === 'expire') nextStatus = 'expired';
    else if (['deny', 'cancel'].includes(status)) nextStatus = 'gagal';
    else if (status === 'pending') nextStatus = 'pending';
    const storedTransactionId = duplicateTransaction ? payment.midtrans_transaction_id : transactionId;
    await connection.query(
      'UPDATE payments SET status=?,metode=?,midtrans_transaction_id=?,midtrans_status_response=? WHERE id=?',
      [nextStatus, notification.payment_type || payment.metode, storedTransactionId || null, JSON.stringify(notification), payment.id],
    );
    if (nextStatus === 'lunas' && payment.tagihan_id && payment.bill_status !== 'Lunas') {
      await connection.query("UPDATE tagihan_salam SET status_bayar='Lunas',tanggal_bayar=NOW(),nominal_dibayar=?,metode_pembayaran='Midtrans' WHERE id=? AND status_bayar<>'Lunas'", [payment.nominal_dibayar, payment.tagihan_id]);
      await syncCustomerBill(connection, payment.tagihan_id);
    }
    await connection.commit();
    return { payment: { ...payment, status: nextStatus, midtrans_transaction_id: storedTransactionId, midtrans_status_response: notification }, customer: payment, accepted: nextStatus === 'lunas', newlyPaid: Boolean(newlyPaid), duplicate: duplicateTransaction };
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

exports.list = async (req, res, next) => {
  try {
    if (isDemo()) return res.json({ success: true, data: paymentScope(req, joinedDemo()) });
    const region = req.user.role === 'superadmin'
      ? (req.query.wilayah && !['all', 'semua'].includes(String(req.query.wilayah).toLowerCase()) ? req.query.wilayah : null)
      : req.user.wilayah;
    const params = [];
    const clauses = [];
    if (region) { clauses.push('c.alamat=?'); params.push(region); }
    if (req.query.status) { clauses.push('pay.status=?'); params.push(req.query.status); }
    if (req.query.metode) { clauses.push('pay.metode=?'); params.push(req.query.metode); }
    const [rows] = await db.query(
      `SELECT pay.*,c.nama,c.id_pelanggan,c.alamat,b.status_bayar bill_status FROM payments pay JOIN pelanggan_salam c ON c.id=pay.pelanggan_id LEFT JOIN tagihan_salam b ON b.id=pay.tagihan_id
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY pay.created_at DESC LIMIT 1000`, params,
    );
    return res.json({ success: true, data: rows });
  } catch (error) { return next(error); }
};

exports.pending = async (req, res, next) => {
  try {
    if (isDemo()) return res.json({ success: true, data: paymentScope(req, joinedDemo().filter((item) => item.status === 'menunggu_verifikasi')) });
    const region = req.user.role === 'superadmin'
      ? (req.query.wilayah && !['all', 'semua'].includes(String(req.query.wilayah).toLowerCase()) ? req.query.wilayah : null)
      : req.user.wilayah;
    const params = [];
    const clauses = ["pay.status='menunggu_verifikasi'", "pay.tipe_pembayaran='manual'"];
    if (region) { clauses.push('c.alamat=?'); params.push(region); }
    const [rows] = await db.query(
      `SELECT pay.*,c.nama,c.id_pelanggan,c.alamat,b.nominal_tagihan bill_amount,b.status_bayar bill_status FROM payments pay JOIN pelanggan_salam c ON c.id=pay.pelanggan_id LEFT JOIN tagihan_salam b ON b.id=pay.tagihan_id WHERE ${clauses.join(' AND ')} ORDER BY pay.created_at`, params,
    );
    return res.json({ success: true, data: rows });
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
      const payment = demo.payments.find((item) => item.id === id);
      const customer = payment && demo.customers.find((item) => item.id === payment.pelanggan_id);
      if (!payment || !customer) return res.status(404).json({ success: false, message: 'Pembayaran tidak ditemukan.' });
      if (!rowAllowed(req, customer.alamat)) return res.status(404).json({ success: false, message: 'Pembayaran tidak ditemukan.' });
      if (payment.status !== 'menunggu_verifikasi' || payment.tipe_pembayaran !== 'manual') return res.status(409).json({ success: false, message: 'Pembayaran ini sudah diproses atau bukan pembayaran manual.' });
      const bill = demo.bills.find((item) => item.id === payment.tagihan_id);
      if (action === 'approve' && (!bill || Number(payment.nominal_dibayar) !== Number(bill.nominal_tagihan))) return res.status(422).json({ success: false, message: 'Nominal pembayaran harus sama dengan tagihan sebelum dapat diterima.' });
      if (action === 'approve' && bill.status_bayar === 'Lunas') return res.status(409).json({ success: false, message: 'Tagihan sudah lunas melalui transaksi lain.' });
      payment.status = action === 'approve' ? 'lunas' : 'ditolak';
      payment.catatan_admin = action === 'reject' ? reason : null;
      payment.verified_by = req.user.id; payment.verified_at = new Date().toISOString();
      if (action === 'approve') {
        bill.status_bayar = 'Lunas'; bill.tanggal_bayar = payment.verified_at; bill.nominal_dibayar = payment.nominal_dibayar; bill.metode_pembayaran = payment.metode || 'Transfer Manual';
        syncDemoCustomerBill(bill);
      }
      const title = action === 'approve' ? 'Pembayaran diterima' : 'Pembayaran ditolak';
      await notifyCustomer(customer.id, { jenis: 'pembayaran', judul: title, pesan: action === 'approve' ? `Pembayaran ${payment.order_id} telah diterima.` : `Pembayaran ${payment.order_id} ditolak: ${reason}`, tautan: '/payments' });
      await sendWhatsApp(customer.nomor_pelanggan, action === 'approve' ? `Pembayaran tagihan ${payment.order_id} telah diterima.` : `Pembayaran ${payment.order_id} ditolak. Alasan: ${reason}`, { jenis: 'pembayaran_manual', wilayah: customer.alamat, idPelanggan: customer.id_pelanggan, dedupeKey: `payment-manual:${payment.id}:${payment.status}` });
      return res.json({ success: true, data: payment });
    }
    const connection = await db.getConnection();
    let customer; let payment;
    try {
      await connection.beginTransaction();
      [[payment]] = await connection.query(
        `SELECT pay.*,c.alamat,c.nama,c.nomor_pelanggan,c.id_pelanggan,b.nominal_tagihan bill_amount,b.status_bayar bill_status
         FROM payments pay JOIN pelanggan_salam c ON c.id=pay.pelanggan_id LEFT JOIN tagihan_salam b ON b.id=pay.tagihan_id WHERE pay.id=? FOR UPDATE`, [id],
      );
      if (!payment || !rowAllowed(req, payment.alamat)) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Pembayaran tidak ditemukan.' }); }
      if (payment.status !== 'menunggu_verifikasi' || payment.tipe_pembayaran !== 'manual') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Pembayaran ini sudah diproses atau bukan pembayaran manual.' }); }
      customer = payment;
      if (action === 'approve' && (!payment.tagihan_id || Number(payment.nominal_dibayar) !== Number(payment.bill_amount))) {
        await connection.rollback(); return res.status(422).json({ success: false, message: 'Nominal pembayaran harus sama dengan tagihan sebelum dapat diterima.' });
      }
      let billStatus = payment.bill_status;
      if (action === 'approve' && payment.tagihan_id) {
        const [[lockedBill]] = await connection.query('SELECT status_bayar FROM tagihan_salam WHERE id=? FOR UPDATE', [payment.tagihan_id]);
        billStatus = lockedBill?.status_bayar;
      }
      if (action === 'approve' && billStatus === 'Lunas') {
        await connection.rollback(); return res.status(409).json({ success: false, message: 'Tagihan sudah lunas melalui transaksi lain.' });
      }
      await connection.query('UPDATE payments SET status=?,catatan_admin=?,verified_by=?,verified_at=NOW() WHERE id=?', [action === 'approve' ? 'lunas' : 'ditolak', action === 'reject' ? reason : null, req.user.id, id]);
      if (action === 'approve') {
        await connection.query("UPDATE tagihan_salam SET status_bayar='Lunas',tanggal_bayar=NOW(),nominal_dibayar=?,metode_pembayaran=? WHERE id=?", [payment.nominal_dibayar, payment.metode || 'Transfer Manual', payment.tagihan_id]);
        await syncCustomerBill(connection, payment.tagihan_id);
      }
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    const title = action === 'approve' ? 'Pembayaran diterima' : 'Pembayaran ditolak';
    await notifyCustomer(payment.pelanggan_id, { jenis: 'pembayaran', judul: title, pesan: action === 'approve' ? `Pembayaran ${payment.order_id} telah diterima.` : `Pembayaran ${payment.order_id} ditolak: ${reason}`, tautan: '/payments' });
    await sendWhatsApp(customer.nomor_pelanggan, action === 'approve' ? `Pembayaran tagihan ${payment.order_id} telah diterima.` : `Pembayaran ${payment.order_id} ditolak. Alasan: ${reason}`, { jenis: 'pembayaran_manual', wilayah: customer.alamat, idPelanggan: customer.id_pelanggan, dedupeKey: `payment-manual:${payment.id}:${action}` });
    return res.json({ success: true });
  } catch (error) { return next(error); }
};

exports.matching = async (req, res, next) => {
  try {
    let rows;
    if (isDemo()) rows = paymentScope(req, joinedDemo());
    else {
      const region = req.user.role === 'superadmin'
        ? (req.query.wilayah && !['all', 'semua'].includes(String(req.query.wilayah).toLowerCase()) ? req.query.wilayah : null)
        : req.user.wilayah;
      const params = [];
      const where = [];
      if (region) { where.push('c.alamat=?'); params.push(region); }
      const [data] = await db.query(
        `SELECT pay.*,c.nama,c.id_pelanggan,c.alamat,b.status_bayar bill_status,b.nominal_tagihan bill_amount FROM payments pay JOIN pelanggan_salam c ON c.id=pay.pelanggan_id LEFT JOIN tagihan_salam b ON b.id=pay.tagihan_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY pay.created_at DESC LIMIT 2000`, params,
      );
      rows = data.map((item) => ({ ...item, nominal_tagihan: Number(item.bill_amount ?? item.nominal_tagihan) }));
    }
    const transactionIdFor = (payment) => {
      if (payment.midtrans_transaction_id) return String(payment.midtrans_transaction_id);
      let payload = payment.midtrans_status_response;
      if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { payload = {}; } }
      return payload?.transaction_id ? String(payload.transaction_id) : null;
    };
    const counts = new Map();
    rows.forEach((payment) => {
      const transactionId = transactionIdFor(payment);
      const key = transactionId ? `transaction:${transactionId}` : null;
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    const paidBills = new Map();
    rows.forEach((payment) => { if (payment.tagihan_id && payment.status === 'lunas') paidBills.set(payment.tagihan_id, (paidBills.get(payment.tagihan_id) || 0) + 1); });
    const result = rows.map((payment) => {
      const transactionDuplicate = payment.midtrans_transaction_id && counts.get(`transaction:${payment.midtrans_transaction_id}`) > 1;
      const billDuplicate = payment.tagihan_id && paidBills.get(payment.tagihan_id) > 1;
      return { ...payment, result: paymentResult(payment, Boolean(transactionDuplicate || billDuplicate)) };
    });
    return res.json({ success: true, data: result });
  } catch (error) { return next(error); }
};

exports.createManualForCustomer = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Bukti transfer wajib diunggah.' });
    const billId = Number(req.body.tagihan_id);
    const amount = Number(req.body.nominal_dibayar);
    const method = String(req.body.metode || '').trim();
    if (!Number.isInteger(billId) || !Number.isFinite(amount) || amount <= 0 || !method) return res.status(400).json({ success: false, message: 'Tagihan, nominal, dan metode pembayaran harus diisi dengan benar.' });
    if (!req.user.pelanggan_id) return res.status(403).json({ success: false, message: 'Akun ini belum terhubung ke pelanggan.' });
    const orderId = `MAN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    if (isDemo()) {
      const bill = demo.bills.find((item) => item.id === billId && item.pelanggan_id === req.user.pelanggan_id);
      if (!bill) return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan.' });
      if (bill.status_bayar === 'Lunas') return res.status(409).json({ success: false, message: 'Tagihan sudah lunas.' });
      if (demo.payments.some((item) => item.tagihan_id === billId && ['pending', 'menunggu_verifikasi'].includes(item.status))) return res.status(409).json({ success: false, message: 'Tagihan sudah memiliki pembayaran yang menunggu proses.' });
      const customer = demo.customers.find((item) => item.id === req.user.pelanggan_id);
      const payment = { id: Math.max(0, ...demo.payments.map((item) => item.id)) + 1, order_id: orderId, pelanggan_id: customer.id, tagihan_id: bill.id, periode: bill.periode, tipe_pembayaran: 'manual', metode, nominal_tagihan: bill.nominal_tagihan, nominal_dibayar: amount, status: 'menunggu_verifikasi', bukti_transfer: `/uploads/bukti_transfer/${require('node:path').basename(req.file.path)}`, created_at: new Date().toISOString() };
      demo.payments.push(payment);
      await notifyAdmins(customer.alamat, { jenis: 'pembayaran', judul: 'Pembayaran manual menunggu verifikasi', pesan: `${customer.nama} mengirim bukti pembayaran ${orderId}.`, tautan: '/payments/manual' });
      return res.status(201).json({ success: true, data: payment });
    }
    const connection = await db.getConnection();
    let payment;
    try {
      await connection.beginTransaction();
      const [[bill]] = await connection.query('SELECT * FROM tagihan_salam WHERE id=? AND pelanggan_id=? FOR UPDATE', [billId, req.user.pelanggan_id]);
      if (!bill) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan.' }); }
      if (bill.status_bayar === 'Lunas') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Tagihan sudah lunas.' }); }
      const [[pending]] = await connection.query("SELECT id FROM payments WHERE tagihan_id=? AND status IN ('pending','menunggu_verifikasi') LIMIT 1 FOR UPDATE", [billId]);
      if (pending) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Tagihan sudah memiliki pembayaran yang menunggu proses.' }); }
      const [created] = await connection.query(
        `INSERT INTO payments (order_id,pelanggan_id,tagihan_id,periode,tipe_pembayaran,metode,nominal_tagihan,nominal_dibayar,status,bukti_transfer)
         VALUES (?,?,?,?,'manual',?,?,?,'menunggu_verifikasi',?)`,
        [orderId, req.user.pelanggan_id, bill.id, bill.periode, method, bill.nominal_tagihan, amount, `/uploads/bukti_transfer/${require('node:path').basename(req.file.path)}`],
      );
      [[payment]] = await connection.query('SELECT * FROM payments WHERE id=?', [created.insertId]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    const [[customer]] = await db.query('SELECT nama,id_pelanggan,alamat FROM pelanggan_salam WHERE id=?', [req.user.pelanggan_id]);
    await notifyAdmins(customer.alamat, { jenis: 'pembayaran', judul: 'Pembayaran manual menunggu verifikasi', pesan: `${customer.nama} mengirim bukti pembayaran ${orderId}.`, tautan: '/payments/manual' });
    return res.status(201).json({ success: true, data: payment });
  } catch (error) { return next(error); }
};

exports.createMidtransForCustomer = async (req, res, next) => {
  try {
    const billId = Number(req.body.tagihan_id);
    if (!Number.isInteger(billId) || !req.user.pelanggan_id) return res.status(400).json({ success: false, message: 'Tagihan tidak valid.' });
    let bill; let customer;
    if (isDemo()) {
      bill = demo.bills.find((item) => item.id === billId && item.pelanggan_id === req.user.pelanggan_id);
      customer = demo.customers.find((item) => item.id === req.user.pelanggan_id);
    } else {
      [[bill]] = await db.query('SELECT * FROM tagihan_salam WHERE id=? AND pelanggan_id=?', [billId, req.user.pelanggan_id]);
      [[customer]] = await db.query('SELECT nama,nomor_pelanggan FROM pelanggan_salam WHERE id=?', [req.user.pelanggan_id]);
    }
    if (!bill || !customer) return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan.' });
    if (bill.status_bayar === 'Lunas') return res.status(409).json({ success: false, message: 'Tagihan sudah lunas.' });
    const orderId = `LM-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    if (isDemo()) {
      if (demo.payments.some((item) => item.tagihan_id === billId && ['pending', 'menunggu_verifikasi'].includes(item.status))) {
        return res.status(409).json({ success: false, message: 'Tagihan sudah memiliki pembayaran yang menunggu proses.' });
      }
      const transaction = await createTransactionToken(orderId, bill.nominal_tagihan, { first_name: customer.nama, phone: customer.nomor_pelanggan });
      const payment = { id: Math.max(0, ...demo.payments.map((item) => item.id)) + 1, order_id: orderId, pelanggan_id: customer.id, tagihan_id: bill.id, periode: bill.periode, tipe_pembayaran: 'midtrans', nominal_tagihan: bill.nominal_tagihan, nominal_dibayar: bill.nominal_tagihan, status: 'pending', snap_token: transaction.token, created_at: new Date().toISOString() };
      demo.payments.push(payment);
      return res.status(201).json({ success: true, data: { order_id: orderId, token: transaction.token, redirect_url: transaction.redirect_url } });
    }
    const connection = await db.getConnection(); let created;
    try {
      await connection.beginTransaction();
      const [[lockedBill]] = await connection.query('SELECT * FROM tagihan_salam WHERE id=? AND pelanggan_id=? FOR UPDATE', [billId, req.user.pelanggan_id]);
      if (!lockedBill) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan.' }); }
      if (lockedBill.status_bayar === 'Lunas') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Tagihan sudah lunas.' }); }
      const [[pending]] = await connection.query("SELECT id FROM payments WHERE tagihan_id=? AND status IN ('pending','menunggu_verifikasi') LIMIT 1 FOR UPDATE", [billId]);
      if (pending) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Tagihan sudah memiliki pembayaran yang menunggu proses.' }); }
      [created] = await connection.query(
        `INSERT INTO payments (order_id,pelanggan_id,tagihan_id,periode,tipe_pembayaran,metode,nominal_tagihan,nominal_dibayar,status)
         VALUES (?,?,?,?,'midtrans','Midtrans',?,?,'pending')`,
        [orderId, req.user.pelanggan_id, lockedBill.id, lockedBill.periode, lockedBill.nominal_tagihan, lockedBill.nominal_tagihan],
      );
      bill = lockedBill;
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    try {
      const transaction = await createTransactionToken(orderId, bill.nominal_tagihan, { first_name: customer.nama, phone: customer.nomor_pelanggan });
      await db.query('UPDATE payments SET snap_token=? WHERE id=?', [transaction.token, created.insertId]);
      return res.status(201).json({ success: true, data: { order_id: orderId, token: transaction.token, redirect_url: transaction.redirect_url } });
    } catch (error) {
      await db.query("UPDATE payments SET status='gagal' WHERE id=?", [created.insertId]);
      throw error;
    }
  } catch (error) { return next(error); }
};

exports.midtransWebhook = async (req, res, next) => {
  try {
    const { order_id: orderId, status_code: statusCode, gross_amount: grossAmount, signature_key: signature } = req.body;
    if (!orderId || !statusCode || !grossAmount || !signature || !process.env.MIDTRANS_SERVER_KEY) return res.status(400).json({ success: false, message: 'Payload webhook tidak lengkap atau Server Key belum dikonfigurasi.' });
    const expected = crypto.createHash('sha512').update(`${orderId}${statusCode}${grossAmount}${process.env.MIDTRANS_SERVER_KEY}`).digest('hex');
    const expectedBytes = Buffer.from(expected); const signatureBytes = Buffer.from(String(signature));
    if (expectedBytes.length !== signatureBytes.length || !crypto.timingSafeEqual(expectedBytes, signatureBytes)) return res.status(401).json({ success: false, message: 'Signature Midtrans tidak valid.' });
    const result = await markMidtransStatus(orderId, req.body);
    if (result.missing) return res.status(404).json({ success: false, message: 'Order ID tidak ditemukan.' });
    recordActivity({
      user: { username: 'midtrans-webhook', role: 'system', wilayah: result.customer?.alamat },
      action: 'WEBHOOK_STATUS', entity: 'payment', entityId: result.payment.id,
      detail: `${orderId}: ${req.body.transaction_status || 'unknown'} → ${result.payment.status}${result.duplicate ? ' (transaksi ganda)' : ''}`,
      ip: req.ip,
    }).catch((error) => console.error('[AUDIT MIDTRANS]', error.message));
    if (result.newlyPaid) {
      const customer = result.customer;
      await notifyCustomer(result.payment.pelanggan_id, { jenis: 'pembayaran', judul: 'Pembayaran berhasil', pesan: `Pembayaran ${orderId} berhasil dan tagihan telah lunas.`, tautan: '/payments' });
      if (customer?.nomor_pelanggan) await sendWhatsApp(customer.nomor_pelanggan, `Pembayaran tagihan ${orderId} berhasil. Terima kasih.`, { jenis: 'pembayaran', wilayah: customer.alamat, idPelanggan: customer.id_pelanggan, dedupeKey: `midtrans:${orderId}:settlement` });
    }
    return res.json({ success: true });
  } catch (error) { return next(error); }
};

exports.exportExcel = async (req, res, next) => {
  try {
    let rows;
    if (isDemo()) rows = paymentScope(req, joinedDemo());
    else {
      const region = req.user.role === 'superadmin' ? (req.query.wilayah && req.query.wilayah !== 'all' ? req.query.wilayah : null) : req.user.wilayah;
      const params = region ? [region] : [];
      [rows] = await db.query(`SELECT pay.*,c.nama,c.id_pelanggan,c.alamat FROM payments pay JOIN pelanggan_salam c ON c.id=pay.pelanggan_id ${region ? 'WHERE c.alamat=?' : ''} ORDER BY pay.created_at DESC`, params);
    }
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Pembayaran');
    sheet.columns = [
      { header: 'Order ID', key: 'order_id', width: 28 }, { header: 'Pelanggan', key: 'nama', width: 25 },
      { header: 'ID Pelanggan', key: 'id_pelanggan', width: 18 }, { header: 'Wilayah', key: 'alamat', width: 18 },
      { header: 'Periode', key: 'periode', width: 16 }, { header: 'Nominal Tagihan', key: 'nominal_tagihan', width: 18 },
      { header: 'Nominal Dibayar', key: 'nominal_dibayar', width: 18 }, { header: 'Metode', key: 'metode', width: 18 },
      { header: 'Status', key: 'status', width: 20 }, { header: 'Tanggal', key: 'created_at', width: 24 },
    ];
    sheet.addRows(rows); sheet.getRow(1).font = { bold: true };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="pembayaran.xlsx"');
    return res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
  } catch (error) { return next(error); }
};
