// server/middleware/roleScope.js
const { ROLES } = require('../config/constants');

const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak. Kewenangan tidak mencukupi.',
      });
    }
    next();
  };
};

const enforceWilayahScope = (req, res, next) => {
  if (req.user.role === ROLES.SUPERADMIN || req.user.wilayah === 'SEMUA') {
    req.wilayahScope = req.query.wilayah || 'all';
  } else {
    // Admin Wilayah dikunci mutlak ke wilayah akunnya
    req.wilayahScope = req.user.wilayah;
  }
  next();
};

module.exports = { requireRoles, enforceWilayahScope };