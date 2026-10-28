const db = require('../config/database');
const { demo, isDemo, normalize } = require('../utils/helpers');
const { currentPeriod, periodDate, dueDateForPeriod } = require('../utils/dates');

async function processMonthlyBilling(periodInput = currentPeriod(), wilayah = null) {
  const period = periodDate(periodInput);
  const dueDate = dueDateForPeriod(period);
  if (isDemo()) {
    const activeCustomers = demo.customers.filter((customer) => customer.status_pelanggan === 'Aktif'
      && (!wilayah || normalize(customer.alamat) === normalize(wilayah)));
    let created = 0;
    let skipped = 0;
    for (const customer of activeCustomers) {
      let bill = demo.bills.find((item) => item.pelanggan_id === customer.id && item.periode === period);
      if (!bill) {
        const id = Math.max(0, ...demo.bills.map((item) => item.id)) + 1;
        const invoice = `INV-${period.slice(0, 7).replace('-', '')}-${customer.id_pelanggan}`;
        bill = {
          id, pelanggan_id: customer.id, periode: period, id_pelanggan_snapshot: customer.id_pelanggan,
          nama_snapshot: customer.nama, alamat_snapshot: customer.alamat, paket_snapshot: customer.paket,
          tarif_snapshot: Number(customer.tarif_langganan), nominal_tagihan: Number(customer.tarif_langganan),
          status_bayar: 'Belum Lunas', tanggal_jatuh_tempo: dueDate, tanggal_bayar: null,
          nominal_dibayar: null, nomor_invoice: invoice, metode_pembayaran: null,
        };
        demo.bills.push(bill);
        created += 1;
      } else skipped += 1;
      if (!customer.waktu || String(customer.waktu).slice(0, 7) <= period.slice(0, 7)) {
        Object.assign(customer, { waktu: period, tagihan: bill.nominal_tagihan, status_bayar: bill.status_bayar, tanggal_bayar: bill.tanggal_bayar, nominal_dibayar: bill.nominal_dibayar, nomor_invoice: bill.nomor_invoice });
      }
    }
    return { created, skipped, eligible: activeCustomers.length, demo: true };
  }

  const connection = await db.getConnection();
  let lockAcquired = false;
  try {
    const [[lock]] = await connection.query("SELECT GET_LOCK('billing_lifemedia_monthly_cron', 15) acquired");
    if (Number(lock.acquired) !== 1) return { created: 0, skipped: 0, eligible: 0, locked: true };
    lockAcquired = true;
    await connection.beginTransaction();
    const params = [];
    let where = "WHERE status_pelanggan='Aktif'";
    if (wilayah) { where += ' AND alamat=?'; params.push(wilayah); }
    const [customers] = await connection.query(`SELECT * FROM pelanggan_salam ${where} FOR UPDATE`, params);
    let created = 0;
    for (const customer of customers) {
      const invoice = `INV-${period.slice(0, 7).replace('-', '')}-${customer.id_pelanggan}`;
      const [result] = await connection.query(
        `INSERT IGNORE INTO tagihan_salam
         (pelanggan_id,periode,id_pelanggan_snapshot,nama_snapshot,alamat_snapshot,paket_snapshot,tarif_snapshot,nominal_tagihan,status_bayar,tanggal_jatuh_tempo,nomor_invoice)
         VALUES (?,?,?,?,?,?,?,?,'Belum Lunas',?,?)`,
        [customer.id, period, customer.id_pelanggan, customer.nama, customer.alamat, customer.paket, customer.tarif_langganan, customer.tarif_langganan, dueDate, invoice],
      );
      created += Number(result.affectedRows || 0);
      const [[bill]] = await connection.query(
        'SELECT nominal_tagihan,status_bayar,tanggal_bayar,nominal_dibayar,nomor_invoice FROM tagihan_salam WHERE pelanggan_id=? AND periode=? FOR UPDATE',
        [customer.id, period],
      );
      await connection.query(
        `UPDATE pelanggan_salam SET waktu=?,tagihan=?,status_bayar=?,tanggal_bayar=?,nominal_dibayar=?,nomor_invoice=?
         WHERE id=? AND DATE_FORMAT(waktu,'%Y-%m')<=DATE_FORMAT(?,'%Y-%m')`,
        [period, bill.nominal_tagihan, bill.status_bayar, bill.tanggal_bayar, bill.nominal_dibayar, bill.nomor_invoice, customer.id, period],
      );
    }
    await connection.commit();
    return { created, skipped: customers.length - created, eligible: customers.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (lockAcquired) await connection.query("SELECT RELEASE_LOCK('billing_lifemedia_monthly_cron')").catch(() => {});
    connection.release();
  }
}

module.exports = { processMonthlyBilling };
