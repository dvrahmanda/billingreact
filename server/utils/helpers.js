const demo = require('../config/demoData');
const { WILAYAH_RESMI, ROLES } = require('../config/constants');

const isDemo = () => String(process.env.DEMO_MODE || 'true').toLowerCase() === 'true';
const normalize = (value) => String(value || '').trim().toUpperCase();

function getWilayahScope(req) {
  if (req.user?.role !== ROLES.SUPERADMIN) return req.user?.wilayah || null;
  const requested = normalize(req.query.wilayah);
  if (!requested || requested === 'ALL' || requested === 'SEMUA') return null;
  return WILAYAH_RESMI.includes(requested) ? requested : null;
}

function scoped(req, rows, field = 'alamat') {
  const scope = getWilayahScope(req);
  return scope ? rows.filter((row) => normalize(row[field]) === normalize(scope)) : rows;
}

const joinCustomer = (row) => {
  const customer = demo.customers.find((item) => item.id === row.pelanggan_id) || {};
  return {
    ...row,
    nama: customer.nama,
    id_pelanggan: customer.id_pelanggan,
    alamat: customer.alamat,
    nomor_pelanggan: customer.nomor_pelanggan,
    koordinat_x: customer.koordinat_x,
    koordinat_y: customer.koordinat_y,
    pppoe_user: customer.pppoe_user,
    pppoe_status: customer.pppoe_status,
  };
};

function pagination(req) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.page_size, 10) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function paginate(rows, req) {
  const { page, pageSize, offset } = pagination(req);
  return {
    data: rows.slice(offset, offset + pageSize),
    pagination: { page, page_size: pageSize, total: rows.length, pages: Math.ceil(rows.length / pageSize) },
  };
}

module.exports = { demo, isDemo, scoped, joinCustomer, pagination, paginate, getWilayahScope, normalize };
