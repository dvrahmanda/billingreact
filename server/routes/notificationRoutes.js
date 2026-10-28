const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/notificationController');

router.use(auth);
router.get('/unread-count', controller.unreadCount);
router.post('/read-all', controller.markAllRead);
router.post('/:id/read', controller.markRead);
router.get('/', controller.list);

module.exports = router;
