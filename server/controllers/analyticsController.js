const db = require('../config/database');
const { demo, isDemo, normalize } = require('../utils/helpers');
const { fetchPPPoE } = require('../services/pppoeProxyService');
const { todayJakarta } = require('../utils/dates');
const { WILAYAH_RESMI } = require('../config/constants');

function lastPeriods(count = 6) {
  const [year, month] = todayJakarta().slice(0, 7).split('-').map(Number);
  return Array.from({ length: count }, (_item, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (count - 1 - index), 1));
    const key = date.toISOString().slice(0, 7);
    return { key, label: date.toLocaleDateString('id-ID', { month: 'short', timeZone: 'UTC' }) };
  });
}

exports.index = async (req, res, next) => {
  try {
    const region = req.wilayahScope && req.wilayahScope !== 'all' ? req.wilayahScope : null;
    const periods = lastPeriods();
    if (isDemo()) {
      const customers = demo.customers.filter((item) => !region || normalize(item.alamat) === normalize(region));
      const customerIds = new Set(customers.map((item) => item.id));
      const bills = demo.bills.filter((item) => customerIds.has(item.pelanggan_id));
      const payments = demo.payments.filter((item) => customerIds.has(item.pelanggan_id));
      const complaints = demo.complaints.filter((item) => customerIds.has(item.pelanggan_id));
      const arrearsByRegion = [...new Set(customers.map((item) => item.alamat))].map((wilayah) => ({
        wilayah, nilai: bills.filter((bill) => bill.alamat_snapshot === wilayah && bill.status_bayar !== 'Lunas').reduce((sum, bill) => sum + Number(bill.nominal_tagihan), 0),
      }));
      const paymentStatus = [
        { name: 'Lunas', value: bills.filter((bill) => bill.status_bayar === 'Lunas').length },
        { name: 'Belum Lunas', value: bills.filter((bill) => bill.status_bayar !== 'Lunas').length },
      ];
      const paymentTrend = periods.map((period) => ({ periode: period.label, nilai: bills.filter((bill) => bill.status_bayar === 'Lunas' && String(bill.tanggal_bayar || '').slice(0, 7) === period.key).reduce((sum, bill) => sum + Number(bill.nominal_dibayar ?? bill.nominal_tagihan), 0) }));
      const complaintStatus = [...new Set(complaints.map((item) => item.status))].map((status) => ({ status: status.replaceAll('_', ' '), jumlah: complaints.filter((item) => item.status === status).length }));
      const pppoe = demo.pppoe.filter((item) => !region || normalize(item.wilayah) === normalize(region));
      const technicianPerformance = demo.technicians.filter((item) => !region || normalize(item.wilayah_tugas) === normalize(region)).map((technician) => {
        const tasks = complaints.filter((item) => item.teknisi_id === technician.id);
        return { nama: technician.nama, aktif: tasks.filter((item) => !['closed', 'ditolak'].includes(item.status)).length, selesai: tasks.filter((item) => ['penanganan_selesai', 'closed'].includes(item.status)).length };
      });
      const regionalComparison = (region ? [region] : WILAYAH_RESMI).map((wilayah) => {
        const customersInRegion = customers.filter((item) => normalize(item.alamat) === normalize(wilayah));
        const regionBills = bills.filter((item) => normalize(item.alamat_snapshot) === normalize(wilayah));
        return { wilayah, pelanggan: customersInRegion.length, aktif: customersInRegion.filter((item) => item.status_pelanggan === 'Aktif').length, tidak_aktif: customersInRegion.filter((item) => item.status_pelanggan !== 'Aktif').length, total_tagihan: regionBills.reduce((sum, item) => sum + Number(item.nominal_tagihan || 0), 0), lunas: regionBills.filter((item) => item.status_bayar === 'Lunas').length, belum_lunas: regionBills.filter((item) => item.status_bayar !== 'Lunas').length, nilai_tunggakan: regionBills.filter((item) => item.status_bayar !== 'Lunas').reduce((sum, item) => sum + Number(item.nominal_tagihan || 0), 0) };
      });
      const unpaidPriorities = customers.map((customer) => {
        const customerBills = bills.filter((bill) => bill.pelanggan_id === customer.id && bill.status_bayar !== 'Lunas');
        return { id: customer.id, nama: customer.nama, id_pelanggan: customer.id_pelanggan, wilayah: customer.alamat, jumlah_tagihan: customerBills.length, nilai_tunggakan: customerBills.reduce((sum, bill) => sum + Number(bill.nominal_tagihan || 0), 0), periode_tertua: customerBills.map((bill) => bill.periode).sort()[0] || null };
      }).filter((item) => item.jumlah_tagihan).sort((a, b) => String(a.periode_tertua).localeCompare(String(b.periode_tertua)) || b.nilai_tunggakan - a.nilai_tunggakan).slice(0, 10);
      const bestPayingCustomers = customers.map((customer) => {
        const customerBills = bills.filter((bill) => bill.pelanggan_id === customer.id);
        const paid = customerBills.filter((bill) => bill.status_bayar === 'Lunas').length;
        return { id: customer.id, nama: customer.nama, id_pelanggan: customer.id_pelanggan, wilayah: customer.alamat, jumlah_lunas: paid, total_tagihan: customerBills.length, persentase_lunas: customerBills.length ? Math.round(paid * 100 / customerBills.length) : 0 };
      }).filter((item) => item.total_tagihan && item.jumlah_lunas).sort((a, b) => b.persentase_lunas - a.persentase_lunas || b.jumlah_lunas - a.jumlah_lunas).slice(0, 10);
      const mapSummary = (region ? [region] : WILAYAH_RESMI).map((wilayah) => ({ wilayah, pelanggan_berkoordinat: customers.filter((item) => normalize(item.alamat) === normalize(wilayah) && item.koordinat_x != null && item.koordinat_y != null).length }));
      return res.json({ success: true, data: {
        customerStats: { total: customers.length, aktif: customers.filter((item) => item.status_pelanggan === 'Aktif').length, tidakAktif: customers.filter((item) => item.status_pelanggan !== 'Aktif').length },
        arrearsByRegion, paymentStatus, paymentTrend, complaintStatus,
        pppoeStatus: [{ name: 'Online', value: pppoe.filter((item) => item.status === 'ONLINE').length }, { name: 'Offline', value: pppoe.filter((item) => item.status === 'OFFLINE').length }],
        technicianPerformance, handlingTimeHours: null, regionalComparison, paymentStatusByRegion: regionalComparison.map(({ wilayah, lunas, belum_lunas }) => ({ wilayah, lunas, belum_lunas })), unpaidPriorities, bestPayingCustomers, mapSummary,
      } });
    }

    const regionClause = region ? ' AND alamat=?' : '';
    const regionParams = region ? [region] : [];
    const [[customerStats]] = await db.query(
      `SELECT COUNT(*) total,SUM(status_pelanggan='Aktif') aktif,SUM(status_pelanggan<>'Aktif') tidakAktif FROM pelanggan_salam WHERE 1=1${regionClause}`, regionParams,
    );
    const [arrearsByRegion] = await db.query(
      `SELECT alamat_snapshot wilayah,SUM(CASE WHEN status_bayar='Belum Lunas' THEN nominal_tagihan ELSE 0 END) nilai FROM tagihan_salam WHERE 1=1${regionClause.replaceAll('alamat', 'alamat_snapshot')} GROUP BY alamat_snapshot ORDER BY alamat_snapshot`, regionParams,
    );
    const [paymentStatusRows] = await db.query(
      `SELECT status_bayar,COUNT(*) jumlah FROM tagihan_salam WHERE 1=1${regionClause.replaceAll('alamat', 'alamat_snapshot')} GROUP BY status_bayar`, regionParams,
    );
    const paymentStatus = ['Lunas', 'Belum Lunas'].map((name) => ({ name, value: Number(paymentStatusRows.find((row) => row.status_bayar === name)?.jumlah || 0) }));
    const [trendRows] = await db.query(
      `SELECT DATE_FORMAT(t.tanggal_bayar,'%Y-%m') periode,COALESCE(SUM(COALESCE(t.nominal_dibayar,t.nominal_tagihan)),0) nilai FROM tagihan_salam t
       WHERE t.status_bayar='Lunas' AND t.tanggal_bayar>=?${region ? ' AND t.alamat_snapshot=?' : ''} GROUP BY DATE_FORMAT(t.tanggal_bayar,'%Y-%m')`, [(`${periods[0].key}-01`), ...regionParams],
    );
    const paymentTrend = periods.map((period) => ({ periode: period.label, nilai: Number(trendRows.find((row) => String(row.periode).slice(0, 7) === period.key)?.nilai || 0) }));
    const [complaintRows] = await db.query(
      `SELECT c.status,COUNT(*) jumlah FROM complaints c JOIN pelanggan_salam p ON p.id=c.pelanggan_id WHERE 1=1${region ? ' AND p.alamat=?' : ''} GROUP BY c.status`, regionParams,
    );
    const complaintStatus = complaintRows.map((row) => ({ status: row.status.replaceAll('_', ' '), jumlah: Number(row.jumlah) }));
    const [technicianPerformance] = await db.query(
      `SELECT t.nama,SUM(c.status NOT IN ('closed','ditolak')) aktif,SUM(c.status IN ('penanganan_selesai','closed')) selesai FROM technicians t
       LEFT JOIN complaints c ON c.teknisi_id=t.id ${region ? 'WHERE t.wilayah_tugas=?' : ''} GROUP BY t.id,t.nama ORDER BY t.nama`, regionParams,
    );
    const [regionalComparison] = await db.query(
      `SELECT p.alamat wilayah,COUNT(DISTINCT p.id) pelanggan,
       COUNT(DISTINCT CASE WHEN p.status_pelanggan='Aktif' THEN p.id END) aktif,
       COUNT(DISTINCT CASE WHEN p.status_pelanggan<>'Aktif' THEN p.id END) tidak_aktif,
       COALESCE(SUM(t.nominal_tagihan),0) total_tagihan,
       COALESCE(SUM(t.status_bayar='Lunas'),0) lunas,
       COALESCE(SUM(t.status_bayar='Belum Lunas'),0) belum_lunas,
       COALESCE(SUM(CASE WHEN t.status_bayar='Belum Lunas' THEN t.nominal_tagihan ELSE 0 END),0) nilai_tunggakan
       FROM pelanggan_salam p LEFT JOIN tagihan_salam t ON t.pelanggan_id=p.id WHERE 1=1${region ? ' AND p.alamat=?' : ''} GROUP BY p.alamat ORDER BY p.alamat`, regionParams,
    );
    const [unpaidPriorities] = await db.query(
      `SELECT p.id,p.nama,p.id_pelanggan,p.alamat wilayah,COUNT(t.id) jumlah_tagihan,
       COALESCE(SUM(t.nominal_tagihan),0) nilai_tunggakan,MIN(t.periode) periode_tertua
       FROM pelanggan_salam p JOIN tagihan_salam t ON t.pelanggan_id=p.id AND t.status_bayar='Belum Lunas'
       WHERE 1=1${region ? ' AND p.alamat=?' : ''} GROUP BY p.id,p.nama,p.id_pelanggan,p.alamat
       ORDER BY periode_tertua ASC,nilai_tunggakan DESC LIMIT 10`, regionParams,
    );
    const [bestPayingCustomers] = await db.query(
      `SELECT p.id,p.nama,p.id_pelanggan,p.alamat wilayah,SUM(t.status_bayar='Lunas') jumlah_lunas,COUNT(t.id) total_tagihan,
       ROUND(100*SUM(t.status_bayar='Lunas')/COUNT(t.id)) persentase_lunas
       FROM pelanggan_salam p JOIN tagihan_salam t ON t.pelanggan_id=p.id WHERE 1=1${region ? ' AND p.alamat=?' : ''}
       GROUP BY p.id,p.nama,p.id_pelanggan,p.alamat HAVING jumlah_lunas>0 ORDER BY persentase_lunas DESC,jumlah_lunas DESC LIMIT 10`, regionParams,
    );
    const [mapSummary] = await db.query(
      `SELECT p.alamat wilayah,COUNT(DISTINCT p.id) pelanggan_berkoordinat FROM pelanggan_salam p
       JOIN pelanggan_detail_salam d ON d.pelanggan_id=p.id WHERE d.koordinat_x IS NOT NULL AND d.koordinat_y IS NOT NULL${region ? ' AND p.alamat=?' : ''}
       GROUP BY p.alamat ORDER BY p.alamat`, regionParams,
    );
    let pppoe = [];
    try { pppoe = (await fetchPPPoE()).filter((item) => !region || normalize(item.wilayah) === normalize(region)); } catch { /* External status is optional. */ }
    const [[handling]] = await db.query(
      `SELECT AVG(TIMESTAMPDIFF(MINUTE,c.created_at,(SELECT MIN(ct.created_at) FROM complaint_timelines ct WHERE ct.complaint_id=c.id AND ct.status='penanganan_selesai'))) avg_minutes
       FROM complaints c JOIN pelanggan_salam p ON p.id=c.pelanggan_id WHERE c.status IN ('penanganan_selesai','closed')${region ? ' AND p.alamat=?' : ''}`, regionParams,
    );
    return res.json({ success: true, data: {
      customerStats: { total: Number(customerStats.total || 0), aktif: Number(customerStats.aktif || 0), tidakAktif: Number(customerStats.tidakAktif || 0) },
      arrearsByRegion, paymentStatus, paymentTrend, complaintStatus,
      pppoeStatus: [{ name: 'Online', value: pppoe.filter((item) => item.status === 'ONLINE').length }, { name: 'Offline', value: pppoe.filter((item) => item.status === 'OFFLINE').length }],
      technicianPerformance, handlingTimeHours: handling.avg_minutes == null ? null : Number(handling.avg_minutes) / 60,
      regionalComparison: regionalComparison.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, ['wilayah'].includes(key) ? value : Number(value || 0)]))),
      paymentStatusByRegion: regionalComparison.map((row) => ({ wilayah: row.wilayah, lunas: Number(row.lunas || 0), belum_lunas: Number(row.belum_lunas || 0) })),
      unpaidPriorities: unpaidPriorities.map((row) => ({ ...row, jumlah_tagihan: Number(row.jumlah_tagihan || 0), nilai_tunggakan: Number(row.nilai_tunggakan || 0) })),
      bestPayingCustomers: bestPayingCustomers.map((row) => ({ ...row, jumlah_lunas: Number(row.jumlah_lunas || 0), total_tagihan: Number(row.total_tagihan || 0), persentase_lunas: Number(row.persentase_lunas || 0) })),
      mapSummary: mapSummary.map((row) => ({ ...row, pelanggan_berkoordinat: Number(row.pelanggan_berkoordinat || 0) })),
    } });
  } catch (error) { return next(error); }
};
