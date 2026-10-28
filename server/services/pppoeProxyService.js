const axios = require('axios');
const db = require('../config/database');
const { demo, isDemo } = require('../utils/helpers');
const { WILAYAH_RESMI } = require('../config/constants');

async function fetchPPPoE() {
  if (isDemo()) return demo.pppoe.map((row) => ({ ...row, last_update: row.last_update || new Date().toISOString() }));
  const url = process.env.PPPOE_API_URL;
  if (!url) return [];
  const headers = process.env.PPPOE_API_TOKEN ? { Authorization: `Bearer ${process.env.PPPOE_API_TOKEN}` } : undefined;
  const { data } = await axios.get(url, { timeout: Number(process.env.PPPOE_TIMEOUT || 6000), headers });
  const rawRows = Array.isArray(data) ? data : (data.data || data.accounts || []);
  if (!Array.isArray(rawRows)) return [];
  const [mappings] = await db.query(
    `SELECT p.id customer_id,p.nama customer_name,p.alamat wilayah,d.pppoe_user username,d.koordinat_x,d.koordinat_y
     FROM pelanggan_salam p JOIN pelanggan_detail_salam d ON d.pelanggan_id=p.id WHERE d.pppoe_user IS NOT NULL AND d.pppoe_user<>''`,
  );
  const byUsername = new Map(mappings.map((item) => [String(item.username).toLowerCase(), item]));
  return rawRows.map((row) => {
    const username = String(row.username || row.user || row.name || '').trim();
    const mapping = byUsername.get(username.toLowerCase());
    const sourceRegion = String(row.wilayah || row.region || row.lokasi || row.location || row.site || '').trim();
    const normalizedSourceRegion = sourceRegion.toUpperCase();
    const inferredRegion = WILAYAH_RESMI.find((region) => normalizedSourceRegion === region || normalizedSourceRegion.includes(region));
    const rawStatus = String(row.status ?? row.state ?? (row.active ? 'online' : 'offline')).toLowerCase();
    const online = ['online', 'active', 'connected', 'true', '1', 'running'].includes(rawStatus);
    return {
      ...row, username, customer_id: mapping?.customer_id || null, customer_name: mapping?.customer_name || null,
      wilayah: mapping?.wilayah || inferredRegion || row.wilayah || row.region || null,
      ip: row.ip || row.address || row['remote-address'] || null,
      mac: row.mac || row['caller-id'] || null,
      router: row.router || row.server || null,
      koordinat_x: mapping?.koordinat_x ?? row.koordinat_x ?? row.latitude ?? row.lat ?? row.x ?? null,
      koordinat_y: mapping?.koordinat_y ?? row.koordinat_y ?? row.longitude ?? row.lon ?? row.lng ?? row.y ?? null,
      uptime: row.uptime || '-',
      status: online ? 'ONLINE' : 'OFFLINE',
      last_update: row.last_update || row.lastUpdate || row.updated_at || new Date().toISOString(),
      koordinat_x: mapping?.koordinat_x || null, koordinat_y: mapping?.koordinat_y || null,
    };
  });
}

module.exports = { fetchPPPoE };
