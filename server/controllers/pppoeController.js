const db = require('../config/database');
const { fetchPPPoE } = require('../services/pppoeProxyService');
const { demo, isDemo, normalize } = require('../utils/helpers');
const { rowAllowed } = require('../middleware/roleScope');

const scopeRegion = (req) => req.user.role === 'superadmin' ? req.wilayahScope : req.user.wilayah;
const inScope = (req, rows) => {
  const region = scopeRegion(req);
  return region && region !== 'all' ? rows.filter((row) => normalize(row.wilayah) === normalize(region)) : rows;
};

const normalizedName = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const accountCoordinates = (account) => ({
  lat: Number(account.koordinat_x ?? account.latitude ?? account.lat ?? account.x),
  lng: Number(account.koordinat_y ?? account.longitude ?? account.lon ?? account.lng ?? account.y),
});
const distanceMeters = (a, b) => {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(a.lat - b.lat); const dLng = radians(a.lng - b.lng);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};
function findAutoMatch(account, customers) {
  const username = String(account.username || '').trim().toLowerCase();
  const sameRegion = customers.filter((customer) => (!account.wilayah || normalize(customer.alamat) === normalize(account.wilayah))
    && (!customer.pppoe_user || String(customer.pppoe_user).toLowerCase() === username));
  const identifierMatches = sameRegion.filter((customer) => [customer.id_pelanggan, customer.kode_pelanggan].some((value) => String(value || '').trim().toLowerCase() === username));
  if (identifierMatches.length) return identifierMatches;
  const sourceName = account.customer_name || account.nama || account.name || account.owner || account.comment || account.identity || account.username;
  const name = normalizedName(sourceName);
  if (name) {
    const nameMatches = sameRegion.filter((customer) => [customer.nama, customer.nama_ktp].some((value) => normalizedName(value) === name));
    if (nameMatches.length) return nameMatches;
  }
  const point = accountCoordinates(account);
  if (Number.isFinite(point.lat) && Number.isFinite(point.lng) && (point.lat !== 0 || point.lng !== 0)) {
    return sameRegion.filter((customer) => {
      const customerPoint = { lat: Number(customer.koordinat_x), lng: Number(customer.koordinat_y) };
      return Number.isFinite(customerPoint.lat) && Number.isFinite(customerPoint.lng)
        && (customerPoint.lat !== 0 || customerPoint.lng !== 0) && distanceMeters(point, customerPoint) <= 30;
    });
  }
  return [];
}

exports.list = async (req, res, next) => {
  try { return res.json({ success: true, data: inScope(req, await fetchPPPoE()) }); }
  catch (error) { return next(error); }
};

exports.unmatched = async (req, res, next) => {
  try { return res.json({ success: true, data: inScope(req, await fetchPPPoE()).filter((row) => !row.customer_id) }); }
  catch (error) { return next(error); }
};

exports.map = async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim(); const customerId = Number(req.body.pelanggan_id);
    if (!username || !Number.isInteger(customerId)) return res.status(400).json({ success: false, message: 'Username PPPoE dan pelanggan wajib dipilih.' });
    const accounts = await fetchPPPoE();
    const account = accounts.find((row) => row.username.toLowerCase() === username.toLowerCase());
    if (!account) return res.status(404).json({ success: false, message: 'Username PPPoE tidak ditemukan pada sumber monitoring.' });
    if (account.customer_id && Number(account.customer_id) !== customerId) return res.status(409).json({ success: false, message: 'Username PPPoE sudah terhubung ke pelanggan lain.' });
    if (account.wilayah && normalize(account.wilayah) !== normalize(req.user.role === 'superadmin' ? req.wilayahScope === 'all' ? account.wilayah : req.wilayahScope : req.user.wilayah)) {
      return res.status(422).json({ success: false, message: 'Akun PPPoE berasal dari wilayah lain.' });
    }
    if (isDemo()) {
      const customer = demo.customers.find((row) => row.id === customerId);
      const pppoe = demo.pppoe.find((row) => row.username.toLowerCase() === username.toLowerCase());
      if (!customer || !pppoe) return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
      if (!rowAllowed(req, customer.alamat) || (req.user.role !== 'superadmin' && normalize(pppoe.wilayah) !== normalize(req.user.wilayah))) return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
      if (pppoe.wilayah && normalize(pppoe.wilayah) !== normalize(customer.alamat)) return res.status(422).json({ success: false, message: 'Akun PPPoE dan pelanggan harus berada pada wilayah yang sama.' });
      if (customer.pppoe_user && customer.pppoe_user.toLowerCase() !== username.toLowerCase()) return res.status(409).json({ success: false, message: 'Pelanggan sudah terhubung ke username PPPoE lain. Lepas mapping terlebih dahulu.' });
      const conflict = demo.customers.find((row) => row.id !== customerId && String(row.pppoe_user || '').toLowerCase() === username.toLowerCase());
      if (conflict) return res.status(409).json({ success: false, message: 'Username PPPoE sudah terhubung ke pelanggan lain.' });
      pppoe.customer_id = customer.id; pppoe.customer_name = customer.nama; pppoe.wilayah = customer.alamat;
      customer.pppoe_user = username; customer.pppoe_status = pppoe.status; customer.pppoe_ip = pppoe.ip; customer.pppoe_mac = pppoe.mac; customer.pppoe_router = pppoe.router;
      return res.json({ success: true, data: pppoe });
    }
    const [[customer]] = await db.query('SELECT p.*,d.pppoe_user FROM pelanggan_salam p LEFT JOIN pelanggan_detail_salam d ON d.pelanggan_id=p.id WHERE p.id=?', [customerId]);
    if (!customer || !rowAllowed(req, customer.alamat)) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    if (account.wilayah && normalize(account.wilayah) !== normalize(customer.alamat)) return res.status(422).json({ success: false, message: 'Akun PPPoE dan pelanggan harus berada pada wilayah yang sama.' });
    if (customer.pppoe_user && customer.pppoe_user.toLowerCase() !== username.toLowerCase()) return res.status(409).json({ success: false, message: 'Pelanggan sudah terhubung ke username PPPoE lain. Lepas mapping terlebih dahulu.' });
    const [[duplicate]] = await db.query('SELECT pelanggan_id FROM pelanggan_detail_salam WHERE LOWER(pppoe_user)=LOWER(?) AND pelanggan_id<>? LIMIT 1', [username, customerId]);
    if (duplicate) return res.status(409).json({ success: false, message: 'Username PPPoE sudah terhubung ke pelanggan lain.' });
    await db.query('INSERT INTO pelanggan_detail_salam (pelanggan_id,pppoe_user) VALUES (?,?) ON DUPLICATE KEY UPDATE pppoe_user=VALUES(pppoe_user)', [customerId, username]);
    return res.json({ success: true, data: { username, customer_id: customerId, customer_name: customer.nama } });
  } catch (error) { return next(error); }
};

exports.autoMatch = async (req, res, next) => {
  try {
    const rows = inScope(req, await fetchPPPoE()).filter((row) => !row.customer_id);
    const matched = []; const skipped = [];
    if (isDemo()) {
      for (const account of rows) {
        const candidates = findAutoMatch(account, demo.customers.filter((customer) => rowAllowed(req, customer.alamat)));
        if (candidates.length !== 1) { skipped.push({ username: account.username, reason: candidates.length ? 'Lebih dari satu pelanggan cocok.' : 'Tidak ditemukan kecocokan ID, nama, atau koordinat.' }); continue; }
        const customer = candidates[0];
        account.customer_id = customer.id; account.customer_name = customer.nama; account.wilayah = customer.alamat; customer.pppoe_user = account.username;
        matched.push({ username: account.username, id_pelanggan: customer.id_pelanggan });
      }
      return res.json({ success: true, data: { matched, skipped } });
    }
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [customers] = await connection.query(
        `SELECT p.id,p.id_pelanggan,p.kode_pelanggan,p.nama,p.alamat,d.nama_ktp,d.pppoe_user,d.koordinat_x,d.koordinat_y
         FROM pelanggan_salam p LEFT JOIN pelanggan_detail_salam d ON d.pelanggan_id=p.id FOR UPDATE`,
      );
      for (const account of rows) {
        const candidates = findAutoMatch(account, customers.filter((customer) => rowAllowed(req, customer.alamat)));
        const customer = candidates.length === 1 ? candidates[0] : null;
        if (!customer) {
          skipped.push({ username: account.username, reason: candidates.length > 1 ? 'Kecocokan nama/koordinat tidak unik pada wilayah ini.' : 'Tidak ditemukan ID, nama, atau koordinat unik pada wilayah ini.' }); continue;
        }
        await connection.query('INSERT INTO pelanggan_detail_salam (pelanggan_id,pppoe_user) VALUES (?,?) ON DUPLICATE KEY UPDATE pppoe_user=VALUES(pppoe_user)', [customer.id, account.username]);
        matched.push({ username: account.username, id_pelanggan: customer.id_pelanggan });
      }
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    return res.json({ success: true, data: { matched, skipped } });
  } catch (error) { return next(error); }
};

exports.unmap = async (req, res, next) => {
  try {
    const username = String(req.params.username || '').trim();
    if (isDemo()) {
      const account = demo.pppoe.find((row) => row.username.toLowerCase() === username.toLowerCase());
      const customer = account?.customer_id ? demo.customers.find((row) => row.id === account.customer_id) : null;
      if (!account || !customer || !rowAllowed(req, customer.alamat)) return res.status(404).json({ success: false, message: 'Mapping tidak ditemukan.' });
      account.customer_id = null; account.customer_name = null; customer.pppoe_user = null; customer.pppoe_status = null; customer.pppoe_ip = null; customer.pppoe_mac = null; customer.pppoe_router = null;
      return res.json({ success: true });
    }
    const [[mapping]] = await db.query('SELECT d.pelanggan_id,p.alamat FROM pelanggan_detail_salam d JOIN pelanggan_salam p ON p.id=d.pelanggan_id WHERE LOWER(d.pppoe_user)=LOWER(?)', [username]);
    if (!mapping || !rowAllowed(req, mapping.alamat)) return res.status(404).json({ success: false, message: 'Mapping tidak ditemukan.' });
    await db.query('UPDATE pelanggan_detail_salam SET pppoe_user=NULL WHERE pelanggan_id=?', [mapping.pelanggan_id]);
    return res.json({ success: true });
  } catch (error) { return next(error); }
};

exports.mapData = async (req, res, next) => {
  try {
    let rows;
    if (isDemo()) {
      const accounts = demo.pppoe;
      rows = demo.customers.filter((customer) => customer.koordinat_x != null && customer.koordinat_y != null).map((customer) => {
        const complaint = demo.complaints.some((item) => item.pelanggan_id === customer.id && !['closed', 'ditolak'].includes(item.status));
        const account = accounts.find((item) => String(item.username).toLowerCase() === String(customer.pppoe_user || '').toLowerCase());
        return { id: customer.id, nama: customer.nama, wilayah: customer.alamat, alamat_lengkap: customer.alamat_lengkap || customer.alamat, username: customer.pppoe_user, status: account?.status || customer.pppoe_status, koordinat_x: account?.koordinat_x ?? customer.koordinat_x, koordinat_y: account?.koordinat_y ?? customer.koordinat_y, complain_aktif: complaint };
      });
    } else {
      const params = []; let where = 'WHERE d.koordinat_x IS NOT NULL AND d.koordinat_y IS NOT NULL';
      const region = scopeRegion(req);
      if (region && region !== 'all') { where += ' AND p.alamat=?'; params.push(region); }
      [rows] = await db.query(
        `SELECT p.id,p.nama,p.alamat wilayah,p.alamat_lengkap,d.pppoe_user username,d.koordinat_x,d.koordinat_y,
         EXISTS(SELECT 1 FROM complaints c WHERE c.pelanggan_id=p.id AND c.status NOT IN ('closed','ditolak')) complain_aktif
         FROM pelanggan_salam p JOIN pelanggan_detail_salam d ON d.pelanggan_id=p.id ${where}`, params,
      );
      const accounts = await fetchPPPoE(); const byUser = new Map(accounts.map((item) => [String(item.username).toLowerCase(), item]));
      rows = rows.map((row) => {
        const account = byUser.get(String(row.username || '').toLowerCase());
        return { ...row, status: account?.status || null, koordinat_x: account?.koordinat_x ?? row.koordinat_x, koordinat_y: account?.koordinat_y ?? row.koordinat_y };
      });
    }
    return res.json({ success: true, data: rows });
  } catch (error) { return next(error); }
};
