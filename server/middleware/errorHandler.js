module.exports = (error, req, res, _next) => {
  console.error('[API ERROR]', req.method, req.originalUrl, error.message);
  let status = Number(error.status || error.statusCode || 500);
  let message = status === 500 ? 'Terjadi kesalahan pada server.' : error.message;
  if (error.name === 'MulterError') {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = error.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file melebihi batas yang diizinkan.' : 'File tidak dapat diproses.';
  }
  if (status < 400 || status > 599) status = 500;
  return res.status(status).json({ success: false, message });
};
