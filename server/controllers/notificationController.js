const db = require('../config/database');
const { demo, isDemo } = require('../utils/helpers');

exports.list = async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    if (isDemo()) {
      const all = demo.notifications.filter((item) => item.user_id === req.user.id);
      return res.json({ success: true, data: all.slice(0, limit), unread: all.filter((item) => !item.dibaca_pada).length });
    }
    const [rows] = await db.query(
      'SELECT * FROM user_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT ?', [req.user.id, limit],
    );
    const [[count]] = await db.query('SELECT COUNT(*) unread FROM user_notifications WHERE user_id=? AND dibaca_pada IS NULL', [req.user.id]);
    return res.json({ success: true, data: rows, unread: Number(count.unread) });
  } catch (error) { return next(error); }
};

exports.unreadCount = async (req, res, next) => {
  try {
    if (isDemo()) return res.json({ success: true, data: demo.notifications.filter((item) => item.user_id === req.user.id && !item.dibaca_pada).length });
    const [[row]] = await db.query('SELECT COUNT(*) total FROM user_notifications WHERE user_id=? AND dibaca_pada IS NULL', [req.user.id]);
    return res.json({ success: true, data: Number(row.total) });
  } catch (error) { return next(error); }
};

exports.markRead = async (req, res, next) => {
  try {
    if (isDemo()) {
      const item = demo.notifications.find((row) => row.id === Number(req.params.id) && row.user_id === req.user.id);
      if (!item) return res.status(404).json({ success: false, message: 'Notifikasi tidak ditemukan.' });
      item.dibaca_pada = new Date().toISOString();
      return res.json({ success: true, data: item });
    }
    const [result] = await db.query('UPDATE user_notifications SET dibaca_pada=NOW() WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Notifikasi tidak ditemukan.' });
    return res.json({ success: true });
  } catch (error) { return next(error); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    if (isDemo()) {
      const now = new Date().toISOString();
      demo.notifications.filter((item) => item.user_id === req.user.id && !item.dibaca_pada).forEach((item) => { item.dibaca_pada = now; });
    } else {
      await db.query('UPDATE user_notifications SET dibaca_pada=NOW() WHERE user_id=? AND dibaca_pada IS NULL', [req.user.id]);
    }
    return res.json({ success: true });
  } catch (error) { return next(error); }
};
