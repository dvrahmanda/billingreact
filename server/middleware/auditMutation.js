const { recordActivity } = require('../services/activityService');

module.exports = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  res.once('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 400 || !req.user) return;
    const parts = req.path.split('/').filter(Boolean);
    const entity = parts[0] || 'api';
    const action = ({ POST: 'CREATE_OR_ACTION', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' })[req.method];
    recordActivity({
      user: req.user,
      action,
      entity,
      entityId: parts[1] && /^\d+$/.test(parts[1]) ? parts[1] : null,
      detail: `${req.method} ${req.path}`,
      ip: req.ip,
    }).catch((error) => console.error('[AUDIT]', error.message));
  });
  return next();
};
