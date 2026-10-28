const r=require('express').Router(),c=require('../controllers/customerController'),auth=require('../middleware/auth'),upload=require('../middleware/upload'),{requireAdmin,enforceWilayahScope}=require('../middleware/roleScope');
r.use(auth,requireAdmin,enforceWilayahScope);
r.get('/export',c.exportExcel);
r.get('/import/template',c.importTemplate);
r.post('/import/preview',upload.excel.single('file'),c.previewImport);
r.post('/import',c.importRows);
r.get('/',c.list);r.get('/:id',c.detail);r.post('/',c.create);r.put('/:id',c.update);r.post('/:id/mobile-account',c.linkMobileAccount);r.post('/:id/photo',upload.homePhoto.single('file'),c.uploadPhoto);
module.exports=r;
