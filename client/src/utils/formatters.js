export const formatRupiah = (value = 0) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));

export const formatDateIndo = (value, withTime = false) => {
  if (!value) return '-';
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = dateOnly ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('id-ID', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }
  ).format(date);
};

export const labelStatus = (value='') =>
  String(value).replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

export const formatWilayahName = (value = '') =>
  String(value).trim().toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, separator, letter) => separator + letter.toUpperCase());

export const displayUserName = (user) => user?.role === 'relawan'
  ? `Admin ${formatWilayahName(user.wilayah)}`.trim()
  : user?.nama_lengkap || user?.username || '';

export const displayUserRole = (user) => user?.role === 'superadmin'
  ? 'Super Admin'
  : user?.role === 'relawan'
    ? 'Admin per Wilayah'
    : `Admin Wilayah ${formatWilayahName(user?.wilayah)}`.trim();
