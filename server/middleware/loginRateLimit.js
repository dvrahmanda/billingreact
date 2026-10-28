const attempts = new Map();
const windowMs = 15 * 60 * 1000;
const maximum = 10;

module.exports = (req, res, next) => {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((time) => now - time < windowMs);
  if (recent.length >= maximum) return res.status(429).json({ success: false, message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' });
  recent.push(now); attempts.set(key, recent);
  if (attempts.size > 10000) {
    for (const [address, times] of attempts) if (!times.some((time) => now - time < windowMs)) attempts.delete(address);
  }
  return next();
};
