const r=require('express').Router(),c=require('../controllers/paymentController'),auth=require('../middleware/auth'),{requireAdmin,enforceWilayahScope}=require('../middleware/roleScope');
r.post('/midtrans/webhook',c.midtransWebhook);
r.use(auth,requireAdmin,enforceWilayahScope);
r.get('/export',c.exportExcel);r.get('/manual-pending',c.pending);r.get('/matching',c.matching);r.post('/verify/:id',c.verify);r.get('/',c.list);
module.exports=r;
