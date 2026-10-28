const db = require('../config/database');
const { demo, isDemo } = require('../utils/helpers');

async function recordActivity({ user, action, entity, entityId = null, detail = '', ip = null }) {
  if (!user) return;
  const entry = {
    user_id: user.id || null,
    username: user.username || 'system',
    role: user.role || 'system',
    wilayah: user.wilayah || null,
    aksi: String(action || 'UPDATE').slice(0, 100),
    entitas: String(entity || 'system').slice(0, 60),
    entitas_id: entityId == null ? null : String(entityId).slice(0, 60),
    rincian: String(detail || '').slice(0, 2000),
    ip_address: ip ? String(ip).slice(0, 50) : null,
    created_at: new Date().toISOString(),
  };
  if (isDemo()) {
    demo.activity.unshift({ id: Date.now(), ...entry });
    demo.activity.length = Math.min(demo.activity.length, 500);
    return;
  }
  await db.query(
    'INSERT INTO audit_logs (user_id,username,role,wilayah,aksi,entitas,entitas_id,rincian,ip_address) VALUES (?,?,?,?,?,?,?,?,?)',
    [entry.user_id, entry.username, entry.role, entry.wilayah, entry.aksi, entry.entitas, entry.entitas_id, entry.rincian, entry.ip_address],
  );
}

module.exports = { recordActivity };
