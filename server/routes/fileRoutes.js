const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/fileController');

router.get('/:folder/:filename', auth, controller.read);
module.exports = router;
