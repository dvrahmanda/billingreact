const r=require('express').Router(),c=require('../controllers/customerController'),auth=require('../middleware/auth'),upload=require('../middleware/upload'),{requireAdmin,requireBillingAccess,enforceWilayahScope}=require('../middleware/roleScope');
r.use(auth,requireBillingAccess,enforceWilayahScope);
r.get('/export',requireAdmin,c.exportExcel);
r.get('/import/template',requireAdmin,c.importTemplate);
r.post('/import/preview',requireAdmin,upload.excel.single('file'),c.previewImport);
r.post('/import',requireAdmin,c.importRows);
r.get('/',c.list);r.get('/:id',c.detail);r.post('/',requireAdmin,c.create);r.put('/:id',requireAdmin,c.update);r.post('/:id/mobile-account',requireAdmin,c.linkMobileAccount);r.post('/:id/photo',requireAdmin,upload.homePhoto.single('file'),c.uploadPhoto);
module.exports=r;
