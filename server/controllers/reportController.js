const ExcelJS = require('exceljs');
const db = require('../config/database');
const { demo, isDemo, normalize } = require('../utils/helpers');
const { periodDate } = require('../utils/dates');

function filters(req) {
  const clauses = [];
  const params = [];
  const region = req.user.role === 'superadmin'
    ? (req.wilayahScope && req.wilayahScope !== 'all' ? req.wilayahScope : null)
    : req.wilayahScope;
  if (region) { clauses.push('t.alamat_snapshot=?'); params.push(region); }
  if (req.query.periode) { clauses.push('t.periode=?'); params.push(periodDate(req.query.periode)); }
  if (req.query.date_from) { clauses.push('t.periode>=?'); params.push(req.query.date_from); }
  if (req.query.date_to) { clauses.push('t.periode<=?'); params.push(req.query.date_to); }
  if (req.query.periode_from) { clauses.push("t.periode>=CONCAT(?,'-01')"); params.push(req.query.periode_from); }
  if (req.query.periode_to) { clauses.push("t.periode<=LAST_DAY(CONCAT(?,'-01'))"); params.push(req.query.periode_to); }
  if (req.query.paid_from) { clauses.push('t.tanggal_bayar>=?'); params.push(req.query.paid_from); }
  if (req.query.paid_to) { clauses.push('t.tanggal_bayar<DATE_ADD(?, INTERVAL 1 DAY)'); params.push(req.query.paid_to); }
  if (req.query.customer_status) { clauses.push('p.status_pelanggan=?'); params.push(req.query.customer_status); }
  if (req.query.q) {
    const search = `%${String(req.query.q).trim()}%`;
    clauses.push('(t.nomor_invoice LIKE ? OR t.id_pelanggan_snapshot LIKE ? OR t.nama_snapshot LIKE ?)');
    params.push(search, search, search);
  }
  if (req.query.status) { clauses.push('t.status_bayar=?'); params.push(req.query.status); }
  if (req.query.metode === 'Midtrans') clauses.push("(LOWER(t.metode_pembayaran)='midtrans' OR EXISTS(SELECT 1 FROM payments pm WHERE pm.tagihan_id=t.id AND pm.tipe_pembayaran='midtrans'))");
  else if (req.query.metode) { clauses.push('t.metode_pembayaran=?'); params.push(req.query.metode); }
  return { clauses, params, region };
}

function buildSummary(rows) {
  return rows.reduce((result, bill) => {
    result.total_tagihan += Number(bill.nominal_tagihan || 0);
    if (bill.status_bayar === 'Lunas') { result.total_pembayaran += Number(bill.nominal_dibayar ?? bill.nominal_tagihan ?? 0); result.lunas += 1; }
    else { result.total_tunggakan += Number(bill.nominal_tagihan || 0); result.belum_lunas += 1; }
    return result;
  }, { total_tagihan: 0, total_pembayaran: 0, total_tunggakan: 0, lunas: 0, belum_lunas: 0 });
}

function byRegion(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.alamat_snapshot;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([wilayah, items]) => ({ wilayah, ...buildSummary(items) })).sort((a, b) => a.wilayah.localeCompare(b.wilayah));
}

async function fetchRows(req) {
  if (isDemo()) {
    const { region } = filters(req);
    return demo.bills.filter((bill) => {
      const customer = demo.customers.find((item) => item.id === bill.pelanggan_id) || {};
      if (region && normalize(bill.alamat_snapshot) !== normalize(region)) return false;
      if (req.query.periode && bill.periode !== periodDate(req.query.periode)) return false;
      if (req.query.date_from && bill.periode < req.query.date_from) return false;
      if (req.query.date_to && bill.periode > req.query.date_to) return false;
      if (req.query.periode_from && String(bill.periode).slice(0, 7) < req.query.periode_from) return false;
      if (req.query.periode_to && String(bill.periode).slice(0, 7) > req.query.periode_to) return false;
      if (req.query.paid_from && String(bill.tanggal_bayar || '').slice(0, 10) < req.query.paid_from) return false;
      if (req.query.paid_to && String(bill.tanggal_bayar || '').slice(0, 10) > req.query.paid_to) return false;
      if (req.query.customer_status && customer.status_pelanggan !== req.query.customer_status) return false;
      if (req.query.q && ![bill.nomor_invoice, bill.id_pelanggan_snapshot, bill.nama_snapshot].some((value) => String(value || '').toLowerCase().includes(String(req.query.q).trim().toLowerCase()))) return false;
      if (req.query.status && bill.status_bayar !== req.query.status) return false;
      if (req.query.metode === 'Midtrans' && String(bill.metode_pembayaran || '').toLowerCase() !== 'midtrans' && !demo.payments.some((payment) => payment.tagihan_id === bill.id && payment.tipe_pembayaran === 'midtrans')) return false;
      if (req.query.metode && req.query.metode !== 'Midtrans' && bill.metode_pembayaran !== req.query.metode) return false;
      return true;
    });
  }
  const { clauses, params } = filters(req);
  const [rows] = await db.query(`SELECT t.*,p.status_pelanggan,p.nomor_pelanggan FROM tagihan_salam t LEFT JOIN pelanggan_salam p ON p.id=t.pelanggan_id ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY t.periode DESC,t.id DESC`, params);
  return rows;
}

exports.financial = async (req, res, next) => {
  try {
    const rows = await fetchRows(req);
    const regions = byRegion(rows);
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.page_size, 10) || 25));
    const offset = (page - 1) * pageSize;
    const details = rows.slice(offset, offset + pageSize).map((row) => ({ ...row, status_pelanggan: row.status_pelanggan || demo.customers.find((item) => item.id === row.pelanggan_id)?.status_pelanggan || null }));
    return res.json({ success: true, data: { summary: buildSummary(rows), byRegion: regions, details, pagination: { page, page_size: pageSize, total: rows.length, pages: Math.ceil(rows.length / pageSize) }, filters: req.query } });
  } catch (error) { return next(error); }
};

exports.exportFinancial = async (req, res, next) => {
  try {
    const rows = await fetchRows(req);
    const workbook = new ExcelJS.Workbook();
    const summary = workbook.addWorksheet('Ringkasan');
    const totals = buildSummary(rows);
    summary.addRows([
      ['Metrik', 'Nilai'], ['Total Tagihan', totals.total_tagihan], ['Total Pembayaran', totals.total_pembayaran],
      ['Total Tunggakan', totals.total_tunggakan], ['Lunas', totals.lunas], ['Belum Lunas', totals.belum_lunas],
    ]);
    summary.getRow(1).font = { bold: true }; summary.getColumn(1).width = 28; summary.getColumn(2).width = 22;
    const details = workbook.addWorksheet('Per Wilayah');
    details.columns = [
      { header: 'Wilayah', key: 'wilayah', width: 20 }, { header: 'Total Tagihan', key: 'total_tagihan', width: 20 },
      { header: 'Pembayaran', key: 'total_pembayaran', width: 20 }, { header: 'Tunggakan', key: 'total_tunggakan', width: 20 },
      { header: 'Lunas', key: 'lunas', width: 12 }, { header: 'Belum Lunas', key: 'belum_lunas', width: 15 },
    ];
    details.addRows(byRegion(rows)); details.getRow(1).font = { bold: true };
    const raw = workbook.addWorksheet('Detail Tagihan');
    raw.columns = [
      { header: 'Invoice', key: 'nomor_invoice', width: 28 }, { header: 'ID Pelanggan', key: 'id_pelanggan_snapshot', width: 20 },
      { header: 'Nama', key: 'nama_snapshot', width: 28 }, { header: 'Wilayah', key: 'alamat_snapshot', width: 18 },
      { header: 'Periode', key: 'periode', width: 16 }, { header: 'Nominal', key: 'nominal_tagihan', width: 18 },
      { header: 'Jatuh Tempo', key: 'tanggal_jatuh_tempo', width: 18 }, { header: 'Status', key: 'status_bayar', width: 18 },
      { header: 'Tanggal Bayar', key: 'tanggal_bayar', width: 22 }, { header: 'Metode', key: 'metode_pembayaran', width: 18 },
    ];
    raw.addRows(rows); raw.getRow(1).font = { bold: true };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="laporan-keuangan.xlsx"');
    return res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
  } catch (error) { return next(error); }
};
