const r=require('express').Router(),c=require('../controllers/paymentController'),auth=require('../middleware/auth'),{requireAdmin,requireBillingAccess,enforceWilayahScope}=require('../middleware/roleScope');
r.post('/midtrans/webhook',c.midtransWebhook);
r.use(auth,requireBillingAccess,enforceWilayahScope);
r.get('/export',requireAdmin,c.exportExcel);r.get('/matching',requireAdmin,c.matching);r.get('/',c.list);
module.exports=r;
