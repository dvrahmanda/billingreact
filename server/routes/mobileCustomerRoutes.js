const router = require('express').Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { requireRoles } = require('../middleware/roleScope');
const customer = require('../controllers/mobileCustomerController');
const payments = require('../controllers/paymentController');

router.use(auth, requireRoles('pelanggan'));
router.get('/dashboard', customer.dashboard);
router.get('/bills', customer.bills);
router.get('/bills/:id', customer.billDetail);
router.get('/payments', customer.payments);
router.post('/payments/midtrans', payments.createMidtransForCustomer);
router.get('/complaints', customer.complaints);
router.post('/complaints', upload.complaintPhoto.single('file'), customer.createComplaint);
router.get('/complaints/:id', customer.complaintDetail);

module.exports = router;
