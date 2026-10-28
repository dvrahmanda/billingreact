const db = require('../config/database');
const { demo, isDemo } = require('../utils/helpers');
const { todayJakarta } = require('../utils/dates');
const { notifyCustomer, sendWhatsApp } = require('./notificationService');

function daysUntil(value, today) {
  const due = new Date(`${String(value).slice(0, 10)}T00:00:00Z`).getTime();
  const current = new Date(`${today}T00:00:00Z`).getTime();
  return Math.round((due - current) / 86400000);
}

async function processDailyReminders(now = new Date()) {
  const today = todayJakarta(now);
  const bills = isDemo()
    ? demo.bills.filter((bill) => bill.status_bayar !== 'Lunas').map((bill) => {
      const customer = demo.customers.find((item) => item.id === bill.pelanggan_id) || {};
      return { ...bill, nomor_pelanggan: customer.nomor_pelanggan, nama: customer.nama, alamat: bill.alamat_snapshot, id_pelanggan: bill.id_pelanggan_snapshot };
    })
    : (await db.query(
      `SELECT b.*,c.nomor_pelanggan,c.nama FROM tagihan_salam b JOIN pelanggan_salam c ON c.id=b.pelanggan_id
       WHERE b.status_bayar='Belum Lunas' AND b.tanggal_jatuh_tempo<=DATE_ADD(?,INTERVAL 7 DAY)`, [today],
    ))[0];
  let eligible = 0; let sent = 0; let duplicates = 0;
  for (const bill of bills) {
    const remaining = daysUntil(bill.tanggal_jatuh_tempo, today);
    const phase = ({ 7: 'h7', 3: 'h3', 1: 'h1', 0: 'due' })[remaining] || (remaining < 0 ? 'overdue' : null);
    if (!phase) continue;
    eligible += 1;
    const title = phase === 'overdue' ? 'Tagihan terlambat' : phase === 'due' ? 'Tagihan jatuh tempo hari ini' : `Pengingat tagihan H-${remaining}`;
    const message = phase === 'overdue'
      ? `Tagihan ${bill.nomor_invoice || bill.id} periode ${String(bill.periode).slice(0, 7)} sudah melewati jatuh tempo. Silakan lakukan pembayaran.`
      : `Tagihan ${bill.nomor_invoice || bill.id} periode ${String(bill.periode).slice(0, 7)} sebesar Rp${Number(bill.nominal_tagihan).toLocaleString('id-ID')} jatuh tempo ${bill.tanggal_jatuh_tempo}.`;
    const result = await sendWhatsApp(bill.nomor_pelanggan, message, {
      jenis: `tagihan_${phase}`, wilayah: bill.alamat || bill.alamat_snapshot, idPelanggan: bill.id_pelanggan || bill.id_pelanggan_snapshot,
      dedupeKey: `bill-reminder:${bill.id}:${phase}`,
    });
    if (result.duplicate) { duplicates += 1; continue; }
    if (result.sent) sent += 1;
    await notifyCustomer(bill.pelanggan_id, { jenis: 'tagihan', judul: title, pesan: message, tautan: `/mobile/customer/bills/${bill.id}` });
  }
  return { eligible, sent, duplicates, date: today };
}

module.exports = { processDailyReminders };
