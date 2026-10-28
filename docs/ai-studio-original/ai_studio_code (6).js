const axios = require('axios');
const db = require('../config/database');

const cleanStr = (val) => String(val || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const calculateHaversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const fetchAndMatchPPPoE = async (wilayahScope = 'all') => {
  const url = process.env.PPPOE_API_URL || 'http://202.169.232.239:8078/api/pppoes';
  const timeout = parseInt(process.env.PPPOE_TIMEOUT, 10) || 6000;

  // 1. Fetch PPPoE stream (READ-ONLY)
  let pppoeList = [];
  try {
    const res = await axios.get(url, { timeout });
    pppoeList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
  } catch (err) {
    throw new Error('Gagal terhubung ke Router Core PPPoE: ' + err.message);
  }

  // 2. Fetch data pelanggan lokal
  let query = `
    SELECT p.id, p.id_pelanggan, p.nama, p.alamat, p.paket, p.status_pelanggan, p.status_bayar,
           d.nama_ktp, d.nik, d.foto_rumah, d.koordinat_x, d.koordinat_y, d.pppoe_user
    FROM pelanggan_salam p
    LEFT JOIN pelanggan_detail_salam d ON d.pelanggan_id = p.id
  `;
  const params = [];
  if (wilayahScope !== 'all') {
    query += ' WHERE p.alamat = ?';
    params.push(wilayahScope);
  }
  const [customers] = await db.query(query, params);

  // 3. Matching
  const matchedData = pppoeList.map((item) => {
    const pppoeId = String(item.id || item.user || '');
    const pppoeUser = cleanStr(item.user || item.username);
    const pppoeLoc = cleanStr(item.lokasi || item.name);

    // Cari manual match dulu
    let matchedCustomer = customers.find(c => c.pppoe_user && c.pppoe_user === pppoeId);

    // Tier 1: Nama Pelanggan + Wilayah
    if (!matchedCustomer) {
      matchedCustomer = customers.find(c => {
        const cName = cleanStr(c.nama);
        const cAlamat = cleanStr(c.alamat);
        return (pppoeUser.includes(cName) || pppoeLoc.includes(cName)) &&
               (pppoeUser.includes(cAlamat) || pppoeLoc.includes(cAlamat));
      });
    }

    // Tier 2: Nama KTP + Wilayah
    if (!matchedCustomer) {
      matchedCustomer = customers.find(c => {
        if (!c.nama_ktp) return false;
        const cKtp = cleanStr(c.nama_ktp);
        const cAlamat = cleanStr(c.alamat);
        return (pppoeUser.includes(cKtp) || pppoeLoc.includes(cKtp)) &&
               (pppoeUser.includes(cAlamat) || pppoeLoc.includes(cAlamat));
      });
    }

    // Tier 3: Radius Koordinat <= 30m
    if (!matchedCustomer && item.latitude && item.longitude) {
      matchedCustomer = customers.find(c => {
        if (!c.koordinat_x || !c.koordinat_y) return false;
        const dist = calculateHaversine(
          parseFloat(c.koordinat_y), parseFloat(c.koordinat_x),
          parseFloat(item.latitude), parseFloat(item.longitude)
        );
        return dist <= 30;
      });
    }

    return {
      id: item.id,
      user: item.user || item.username,
      lokasi: item.lokasi || item.name,
      ip: item.ip || '-',
      status: String(item.status || 'UNKNOWN').toUpperCase(),
      latitude: parseFloat(item.latitude) || null,
      longitude: parseFloat(item.longitude) || null,
      billing: matchedCustomer ? {
        id: matchedCustomer.id,
        id_pelanggan: matchedCustomer.id_pelanggan,
        nama: matchedCustomer.nama,
        nama_ktp: matchedCustomer.nama_ktp,
        nik: matchedCustomer.nik,
        alamat: matchedCustomer.alamat,
        paket: matchedCustomer.paket,
        status_pelanggan: matchedCustomer.status_pelanggan,
        status_bayar: matchedCustomer.status_bayar,
        foto_rumah: matchedCustomer.foto_rumah,
      } : null,
    };
  });

  return matchedData;
};

module.exports = { fetchAndMatchPPPoE };