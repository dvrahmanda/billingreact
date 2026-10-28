const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const uploadRoot = path.join(__dirname, '..', 'uploads');
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function imageUpload(folder) {
  const destination = path.join(uploadRoot, folder);
  fs.mkdirSync(destination, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => callback(null, destination),
      filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (imageExtensions.has(ext) && imageMimeTypes.has(file.mimetype)) return callback(null, true);
      return callback(new Error('Format gambar harus JPG, PNG, atau WEBP.'));
    },
  });
}

const excel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.csv') return callback(null, true);
    return callback(new Error('Gunakan workbook .xlsx atau file .csv. Format .xls lama perlu disimpan ulang sebagai .xlsx.'));
  },
});

module.exports = {
  excel,
  homePhoto: imageUpload('foto_rumah'),
  complaintPhoto: imageUpload('foto_complain'),
  resultPhoto: imageUpload('foto_penanganan'),
  transferProof: imageUpload('bukti_transfer'),
};
