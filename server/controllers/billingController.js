const ExcelJS = require('exceljs');
const db = require('../config/database');
const { demo, isDemo, pagination, normalize } = require('../utils/helpers');
const { rowAllowed } = require('../middleware/roleScope');
const { fetchPPPoE } = require('../services/pppoeProxyService');
const { processMonthlyBilling } = require('../services/automatedBillingService');
const { currentPeriod, periodDate } = require('../utils/dates');

function regionFor(req) { return req.wilayahScope && req.wilayahScope !== 'all' ? req.wilayahScope : null; }

function filterDemoBills(req) {
  const region = regionFor(req);
  const q = String(req.query.q || '').toLowerCase();
  return demo.bills.filter((bill) => {
    if (region && normalize(bill.alamat_snapshot) !== normalize(region)) return false;
    if (req.query.status && bill.status_bayar !== req.query.status) return false;
    if (req.query.periode && bill.periode.slice(0, 7) !== String(req.query.periode).slice(0, 7)) return false;
    if (req.query.date_from && bill.periode < req.query.date_from) return false;
    if (req.query.date_to && bill.periode > req.query.date_to) return false;
    if (req.query.metode && String(bill.metode_pembayaran || '').toLowerCase() !== String(req.query.metode).toLowerCase()) return false;
    if (q && !`${bill.nama_snapshot} ${bill.id_pelanggan_snapshot} ${bill.nomor_invoice}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function billWhere(req, table = 't') {
  const clauses = [];
  const params = [];
  const region = regionFor(req);
  if (region) { clauses.push(`${table}.alamat_snapshot=?`); params.push(region); }
  if (req.query.status) { clauses.push(`${table}.status_bayar=?`); params.push(req.query.status); }
  if (req.query.periode) { clauses.push(`${table}.periode=?`); params.push(periodDate(req.query.periode)); }
  if (req.query.date_from) { clauses.push(`${table}.periode>=?`); params.push(req.query.date_from); }
  if (req.query.date_to) { clauses.push(`${table}.periode<=?`); params.push(req.query.date_to); }
  if (req.query.metode) { clauses.push(`${table}.metode_pembayaran=?`); params.push(req.query.metode); }
  if (req.query.q) {
    clauses.push(`(${table}.nama_snapshot LIKE ? OR ${table}.id_pelanggan_snapshot LIKE ? OR ${table}.nomor_invoice LIKE ?)`);
    const like = `%${req.query.q}%`; params.push(like, like, like);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

exports.dashboard = async (req, res, next) => {
  try {
    const region = regionFor(req);
    const period = currentPeriod();
    if (isDemo()) {
      const customers = demo.customers.filter((customer) => !region || normalize(customer.alamat) === normalize(region));
      const ids = new Set(customers.map((customer) => customer.id));
      const bills = demo.bills.filter((bill) => ids.has(bill.pelanggan_id) && bill.periode === period);
      const currentPayments = demo.payments.filter((payment) => ids.has(payment.pelanggan_id) && payment.status === 'lunas' && payment.periode === period);
      const complaints = demo.complaints.filter((item) => ids.has(item.pelanggan_id));
      const activeComplaints = complaints.filter((item) => !['closed', 'ditolak'].includes(item.status));
      const pppoe = demo.pppoe.filter((item) => !region || normalize(item.wilayah) === normalize(region));
      const technicianIds = new Set(activeComplaints.map((item) => item.teknisi_id).filter(Boolean));
      const recentComplaints = activeComplaints.slice(0, 8).map((item) => {
        const customer = customers.find((row) => row.id === item.pelanggan_id) || {};
        return { ...item, nama: customer.nama, id_pelanggan: customer.id_pelanggan, wilayah: customer.alamat };
      });
      return res.json({ success: true, data: { period, stats: {
        totalPelanggan: customers.length,
        pelangganAktif: customers.filter((item) => item.status_pelanggan === 'Aktif').length,
        pelangganTidakAktif: customers.filter((item) => item.status_pelanggan !== 'Aktif').length,
        totalTagihan: bills.length,
        lunas: bills.filter((item) => item.status_bayar === 'Lunas').length,
        belumLunas: bills.filter((item) => item.status_bayar !== 'Lunas').length,
        totalTunggakan: bills.filter((item) => item.status_bayar !== 'Lunas').reduce((sum, item) => sum + Number(item.nominal_tagihan), 0),
        totalPembayaran: currentPayments.reduce((sum, item) => sum + Number(item.nominal_dibayar), 0),
        pppoeOnline: pppoe.filter((item) => item.status === 'ONLINE').length,
        pppoeOffline: pppoe.filter((item) => item.status === 'OFFLINE').length,
        complainAktif: activeComplaints.length,
        complainBaru: complaints.filter((item) => item.status === 'menunggu_verifikasi').length,
        teknisiBertugas: technicianIds.size,
      }, recentComplaints } });
    }

    const customerWhere = region ? 'WHERE alamat=?' : '';
    const customerParams = region ? [region] : [];
    const billWhereSql = region ? 'WHERE alamat_snapshot=? AND periode=?' : 'WHERE periode=?';
    const billParams = region ? [region, period] : [period];
    const paymentWhere = region ? 'WHERE c.alamat=? AND pay.periode=?' : 'WHERE pay.periode=?';
    const paymentParams = region ? [region, period] : [period];
    const complaintWhere = region ? 'WHERE c.alamat=?' : '';
    const complaintParams = region ? [region] : [];
    const [[customerStats]] = await db.query(
      `SELECT COUNT(*) totalPelanggan,SUM(status_pelanggan='Aktif') pelangganAktif,SUM(status_pelanggan<>'Aktif') pelangganTidakAktif FROM pelanggan_salam ${customerWhere}`,
      customerParams,
    );
    const [[billStats]] = await db.query(
      `SELECT COUNT(*) totalTagihan,SUM(status_bayar='Lunas') lunas,SUM(status_bayar='Belum Lunas') belumLunas,SUM(CASE WHEN status_bayar='Belum Lunas' THEN nominal_tagihan ELSE 0 END) totalTunggakan FROM tagihan_salam ${billWhereSql}`,
      billParams,
    );
    const [[paymentStats]] = await db.query(
      "SELECT COALESCE(SUM(CASE WHEN pay.status='lunas' AND pay.tipe_pembayaran='midtrans' THEN pay.nominal_dibayar ELSE 0 END),0) totalPembayaran FROM payments pay JOIN pelanggan_salam c ON c.id=pay.pelanggan_id " + paymentWhere,
      paymentParams,
    );
    const [[complaintStats]] = await db.query(
      `SELECT SUM(c.status NOT IN ('closed','ditolak')) complainAktif,SUM(c.status='menunggu_verifikasi') complainBaru,COUNT(DISTINCT CASE WHEN c.status NOT IN ('closed','ditolak') THEN c.teknisi_id END) teknisiBertugas FROM complaints c JOIN pelanggan_salam p ON p.id=c.pelanggan_id ${complaintWhere.replaceAll('c.alamat', 'p.alamat')}`,
      complaintParams,
    );
    const [recentComplaints] = await db.query(
      `SELECT c.id,c.nomor_tiket,c.kategori,c.status,p.nama,p.id_pelanggan,p.alamat wilayah FROM complaints c JOIN pelanggan_salam p ON p.id=c.pelanggan_id ${complaintWhere.replaceAll('c.alamat', 'p.alamat')} ${complaintWhere ? 'AND' : 'WHERE'} c.status NOT IN ('closed','ditolak') ORDER BY c.created_at DESC LIMIT 8`,
      complaintParams,
    );
    let pppoeOnline = 0; let pppoeOffline = 0;
    try {
      const rows = await fetchPPPoE();
      const scopedRows = rows.filter((item) => !region || normalize(item.wilayah) === normalize(region));
      pppoeOnline = scopedRows.filter((item) => item.status === 'ONLINE').length;
      pppoeOffline = scopedRows.filter((item) => item.status === 'OFFLINE').length;
    } catch { /* PPPoE is an optional external source. */ }
    return res.json({ success: true, data: { period, stats: {
      ...customerStats, ...billStats, ...paymentStats, ...complaintStats,
      totalPelanggan: Number(customerStats.totalPelanggan || 0), pelangganAktif: Number(customerStats.pelangganAktif || 0),
      pelangganTidakAktif: Number(customerStats.pelangganTidakAktif || 0), totalTagihan: Number(billStats.totalTagihan || 0),
      lunas: Number(billStats.lunas || 0), belumLunas: Number(billStats.belumLunas || 0),
      totalTunggakan: Number(billStats.totalTunggakan || 0), totalPembayaran: Number(paymentStats.totalPembayaran || 0),
      complainAktif: Number(complaintStats.complainAktif || 0),
      complainBaru: Number(complaintStats.complainBaru || 0), teknisiBertugas: Number(complaintStats.teknisiBertugas || 0), pppoeOnline, pppoeOffline,
    }, recentComplaints } });
  } catch (error) { return next(error); }
};

exports.list = async (req, res, next) => {
  try {
    const rows = isDemo() ? filterDemoBills(req) : null;
    if (isDemo()) {
      const { page, pageSize, offset } = pagination(req);
      return res.json({ success: true, data: rows.slice(offset, offset + pageSize), pagination: { page, page_size: pageSize, total: rows.length, pages: Math.ceil(rows.length / pageSize) } });
    }
    const { where, params } = billWhere(req);
    const { page, pageSize, offset } = pagination(req);
    const [[count]] = await db.query(`SELECT COUNT(*) total FROM tagihan_salam t ${where}`, params);
    const [data] = await db.query(`SELECT t.* FROM tagihan_salam t ${where} ORDER BY t.periode DESC,t.nama_snapshot LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
    return res.json({ success: true, data, pagination: { page, page_size: pageSize, total: Number(count.total), pages: Math.ceil(Number(count.total) / pageSize) } });
  } catch (error) { return next(error); }
};

exports.detail = async (req, res, next) => {
  try {
    if (isDemo()) {
      const bill = demo.bills.find((item) => item.id === Number(req.params.id));
      if (!bill || !rowAllowed(req, bill.alamat_snapshot)) return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan.' });
      return res.json({ success: true, data: { ...bill, payments: demo.payments.filter((item) => item.tagihan_id === bill.id) } });
    }
    const [[bill]] = await db.query('SELECT * FROM tagihan_salam WHERE id=?', [req.params.id]);
    if (!bill || !rowAllowed(req, bill.alamat_snapshot)) return res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan.' });
    const [payments] = await db.query('SELECT * FROM payments WHERE tagihan_id=? ORDER BY created_at DESC', [bill.id]);
    return res.json({ success: true, data: { ...bill, payments } });
  } catch (error) { return next(error); }
};

exports.generate = async (req, res, next) => {
  try {
    const period = periodDate(req.body.periode);
    const result = await processMonthlyBilling(period, req.user.role === 'superadmin' ? req.body.wilayah : req.user.wilayah);
    return res.json({ success: true, data: { period, ...result } });
  } catch (error) { return next(error); }
};

exports.exportExcel = async (req, res, next) => {
  try {
    let rows;
    if (isDemo()) rows = filterDemoBills(req);
    else {
      const { where, params } = billWhere(req);
      [rows] = await db.query(`SELECT * FROM tagihan_salam t ${where} ORDER BY periode DESC,nama_snapshot`, params);
    }
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tagihan');
    sheet.columns = [
      { header: 'Invoice', key: 'nomor_invoice', width: 26 }, { header: 'ID Pelanggan', key: 'id_pelanggan_snapshot', width: 20 },
      { header: 'Nama', key: 'nama_snapshot', width: 28 }, { header: 'Wilayah', key: 'alamat_snapshot', width: 18 },
      { header: 'Periode', key: 'periode', width: 16 }, { header: 'Nominal', key: 'nominal_tagihan', width: 18 },
      { header: 'Jatuh Tempo', key: 'tanggal_jatuh_tempo', width: 18 }, { header: 'Status', key: 'status_bayar', width: 18 },
      { header: 'Tanggal Bayar', key: 'tanggal_bayar', width: 22 }, { header: 'Metode', key: 'metode_pembayaran', width: 18 },
    ];
    sheet.addRows(rows); sheet.getRow(1).font = { bold: true };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="tagihan.xlsx"');
    return res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
  } catch (error) { return next(error); }
};
