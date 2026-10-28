const { ROLES, WILAYAH_RESMI } = require('../config/constants');
const { normalize } = require('../utils/helpers');

const requireRoles = (...roles) => (req, res, next) => {
  if (req.user && roles.includes(req.user.role)) return next();
  return res.status(403).json({ success: false, message: 'Akses ditolak.' });
};

const requireAdmin = requireRoles(ROLES.SUPERADMIN, ROLES.ADMIN);

const enforceWilayahScope = (req, res, next) => {
  if (req.user?.role === ROLES.SUPERADMIN) {
    const requested = normalize(req.query.wilayah);
    if (requested && !['ALL', 'SEMUA'].includes(requested) && !WILAYAH_RESMI.includes(requested)) {
      return res.status(400).json({ success: false, message: 'Wilayah tidak dikenal.' });
    }
    req.wilayahScope = requested && !['ALL', 'SEMUA'].includes(requested) ? requested : 'all';
  } else {
    req.wilayahScope = req.user?.wilayah;
  }
  return next();
};

const rowAllowed = (req, wilayah) => req.user?.role === ROLES.SUPERADMIN
  || normalize(wilayah) === normalize(req.user?.wilayah);

module.exports = { requireRoles, requireAdmin, enforceWilayahScope, rowAllowed };
