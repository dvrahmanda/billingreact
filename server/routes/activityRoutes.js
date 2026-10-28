const router = require('express').Router();
const auth = require('../middleware/auth');
const { requireRoles } = require('../middleware/roleScope');
const { activity } = require('../controllers/adminController');

router.use(auth, requireRoles('superadmin'));
router.get('/', activity);

module.exports = router;
