const router = require('express').Router();
const controller = require('../controllers/pppoeController');
const auth = require('../middleware/auth');
const { requireAdmin, enforceWilayahScope } = require('../middleware/roleScope');

router.use(auth, requireAdmin, enforceWilayahScope);
router.get('/unmatched', controller.unmatched);
router.get('/readonly/map', controller.readonlyMapData);
router.all('/readonly/map', (req, res) => res.status(405).json({
  success: false,
  read_only: true,
  message: 'Peta PPPoE hanya mendukung pembacaan data.',
}));
router.post('/match', controller.autoMatch);
router.post('/map', controller.map);
router.delete('/map/:username', controller.unmap);
router.get('/', controller.list);

module.exports = router;