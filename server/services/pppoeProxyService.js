const axios = require('axios');
const db = require('../config/database');
const { demo, isDemo } = require('../utils/helpers');
const { WILAYAH_RESMI } = require('../config/constants');

const ONLINE_STATES = new Set(['online', 'active', 'connected', 'true', '1', 'running']);
const OFFLINE_STATES = new Set(['offline', 'disconnected', 'inactive', 'false', '0', 'stopped', 'disabled']);
const REGION_ALIASES = {
  SALAM: ['salam', 'slm'],
  BARAN: ['baran', 'brn'],
  GUNUNGMANUK: ['gunungmanuk', 'gunung', 'gm', 'gnm'],
  NGASEMAYU: ['ngasemayu', 'ngasem', 'nga'],
  TROSARI: ['trosari', 'trs'],
  WADUK: ['waduk', 'wdk'],
};

function numericCoordinate(...values) {
  const value = values.find((item) => item !== null && item !== undefined && String(item).trim() !== '');
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;
  for (const key of ['data', 'accounts', 'pppoes', 'rows', 'items', 'result']) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const rows = extractRows(payload[key]);
      if (rows !== null) return rows;
    }
  }
  return null;
}

function inferRegion(values) {
  const text = values.filter(Boolean).map(String).join(' ').toLowerCase();
  const compact = text.replace(/[^a-z0-9]+/g, '');
  for (const region of WILAYAH_RESMI) {
    if (compact.includes(region.toLowerCase())) return region;
    for (const alias of REGION_ALIASES[region] || []) {
      if (new RegExp(`(^|[^a-z0-9])${alias}(?=$|[^a-z0-9])`, 'i').test(text)) return region;
    }
  }
  return null;
}

function normalizeStatus(row) {
  const active = row.active ?? row.connected ?? row.running;
  const activeStatus = active === true || ['true', '1'].includes(String(active).toLowerCase())
    ? 'online'
    : active === false || ['false', '0'].includes(String(active).toLowerCase()) ? 'offline' : '';
  const value = String(row.status ?? row.state ?? activeStatus).trim().toLowerCase();
  return ONLINE_STATES.has(value) ? 'ONLINE' : OFFLINE_STATES.has(value) ? 'OFFLINE' : 'UNKNOWN';
}

function normalizeSourceRow(row) {
  const username = String(row.username || row.user || row.pppoe_user || row.login || row.name || '').trim();
  const location = String(row.lokasi || row.location || row.site || row.name || row.nama || '').trim();
  const rawRegion = row.wilayah || row.region || '';
  const inferredRegion = inferRegion([rawRegion, row.lokasi, row.location, row.site, username]);
  const latitude = numericCoordinate(row.latitude, row.lat, row.koordinat_y, row.y);
  const longitude = numericCoordinate(row.longitude, row.lng, row.lon, row.koordinat_x, row.x);
  return {
    ...row,
    id: row.id ?? row._id ?? username,
    username,
    user: row.user || username,
    lokasi: location,
    wilayah: inferredRegion || rawRegion || null,
    ip: row.ip || row.address || row['remote-address'] || null,
    mac: row.mac || row['caller-id'] || null,
    router: row.router || row.server || null,
    latitude,
    longitude,
    koordinat_x: longitude,
    koordinat_y: latitude,
    uptime: row.uptime || '-',
    status: normalizeStatus(row),
    last_update: row.last_update || row.lastUpdate || row.updated_at || null,
  };
}

// Membaca monitoring langsung dengan HTTP GET. Fungsi ini tidak membaca demo
// Billing dan tidak melakukan query atau perubahan apa pun ke database.
async function fetchPPPoESource() {
  const url = process.env.PPPOE_API_URL;
  if (!url) {
    const error = new Error('URL sumber monitoring PPPoE belum dikonfigurasi.');
    error.status = 503;
    throw error;
  }
  const headers = { Accept: 'application/json' };
  if (process.env.PPPOE_API_TOKEN) headers.Authorization = `Bearer ${process.env.PPPOE_API_TOKEN}`;
  let data;
  try {
    ({ data } = await axios.get(url, {
      timeout: Number(process.env.PPPOE_TIMEOUT || 6000),
      headers,
    }));
  } catch (sourceError) {
    const message = sourceError.response?.status
      ? `Website monitoring PPPoE merespons HTTP ${sourceError.response.status}.`
      : 'Website monitoring PPPoE tidak dapat dihubungi. Periksa URL dan pastikan server monitoring aktif.';
    const error = new Error(message);
    error.status = 502;
    throw error;
  }
  const rawRows = extractRows(data);
  if (!rawRows) {
    const error = new Error('Respons sumber monitoring PPPoE tidak berisi daftar akun.');
    error.status = 502;
    throw error;
  }
  return rawRows
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
    .map(normalizeSourceRow);
}

async function fetchPPPoE() {
  if (isDemo()) return demo.pppoe.map((row) => ({ ...row, last_update: row.last_update || new Date().toISOString() }));

  const sourceRows = await fetchPPPoESource();
  if (!sourceRows.length) return [];
  const [mappings] = await db.query(
    `SELECT p.id customer_id,p.nama customer_name,p.alamat wilayah,d.pppoe_user username
     FROM pelanggan_salam p JOIN pelanggan_detail_salam d ON d.pelanggan_id=p.id WHERE d.pppoe_user IS NOT NULL AND d.pppoe_user<>''`,
  );
  const byUsername = new Map(mappings.map((item) => [String(item.username).toLowerCase(), item]));
  return sourceRows.map((row) => {
    const mapping = byUsername.get(row.username.toLowerCase());
    return {
      ...row,
      customer_id: mapping?.customer_id || null,
      customer_name: mapping?.customer_name || null,
      wilayah: mapping?.wilayah || row.wilayah,
      last_update: row.last_update || new Date().toISOString(),
    };
  });
}

module.exports = { fetchPPPoE, fetchPPPoESource };
