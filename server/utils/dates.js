function jakartaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function todayJakarta(date = new Date()) {
  const { year, month, day } = jakartaParts(date);
  return `${year}-${month}-${day}`;
}

function currentPeriod(date = new Date()) {
  return `${todayJakarta(date).slice(0, 7)}-01`;
}

function periodDate(value, fallback = currentPeriod()) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return fallback;
  return `${match[1]}-${match[2]}-01`;
}

function dueDateForPeriod(period, day = 20) {
  const normalized = periodDate(period);
  const [year, month] = normalized.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

module.exports = { jakartaParts, todayJakarta, currentPeriod, periodDate, dueDateForPeriod };
