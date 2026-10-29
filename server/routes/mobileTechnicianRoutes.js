const router = require('express').Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { requireRoles } = require('../middleware/roleScope');
const controller = require('../controllers/mobileTechnicianController');

router.use(auth, requireRoles('teknisi'));
router.get('/dashboard', controller.dashboard);
router.get('/tasks', controller.taskList);
router.get('/tasks/:id', controller.taskDetail);
router.patch('/tasks/:id/status', upload.resultPhoto.single('file'), controller.updateTask);
router.post('/location', controller.updateLocation);

module.exports = router;
