export function tzDateStr(tz, d = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const g = t => p.find(x => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}
export function tzTimeStr(tz, d = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const g = t => p.find(x => x.type === t).value;
  return `${g('hour')}:${g('minute')}`;
}
export function isReportCurrent(reportDate, isTW) {
  if (!reportDate) return false;
  const date = reportDate.replace(/\//g, '-');
  const now = new Date();
  if (isTW) {
    return date === tzDateStr('Asia/Taipei', now);
  } else {
    const etToday = tzDateStr('America/New_York', now);
    if (date === etToday) return true;
    // scout.py saves card with UTC date when market is live
    if (date === tzDateStr('UTC', now)) return true;
    // On weekends, accept the most recent Friday (last US trading day)
    const etDow = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long' }).format(now);
    if (etDow === 'Saturday') return date === tzDateStr('America/New_York', new Date(now - 86400000));
    if (etDow === 'Sunday')   return date === tzDateStr('America/New_York', new Date(now - 2 * 86400000));
    // Weekday: accept yesterday's report before market opens
    const etYesterday = tzDateStr('America/New_York', new Date(now - 86400000));
    return date === etYesterday && tzTimeStr('America/New_York', now) < '09:30';
  }
}

export function getChangeColor(v, code = '') {
  if (v == null || v === 0) return '#cbd5e1';
  const isTw = /\.TW$/i.test(code) || /^\d{4,6}[A-Z]?$/i.test(code);
  if (isTw) {
    return v > 0 ? '#ff5a5a' : '#33cc77'; // 台股：紅漲綠跌
  }
  return v > 0 ? '#4ade80' : '#f87171';   // 美股：綠漲紅跌
}

export function getWatchlist() {
  try {
    return JSON.parse(localStorage.getItem('watchlist') || '[]');
  } catch {
    return [];
  }
}

export function addToWatchlist(code, name = '') {
  const raw = (code || '').trim().toUpperCase();
  const norm = /^\d{4,6}[A-Z]?$/.test(raw) ? raw + '.TW' : raw;
  if (!norm) return false;
  const list = getWatchlist();
  if (list.some(w => (w.code || '').toUpperCase() === norm)) {
    return false;
  }
  const next = [...list, { code: norm, name: name || norm }];
  localStorage.setItem('watchlist', JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('watchlistchange', { detail: next }));
  return true;
}

export function removeFromWatchlist(code) {
  const raw = (code || '').trim().toUpperCase();
  const norm = /^\d{4,6}[A-Z]?$/.test(raw) ? raw + '.TW' : raw;
  const list = getWatchlist();
  const next = list.filter(w => (w.code || '').toUpperCase() !== norm);
  localStorage.setItem('watchlist', JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('watchlistchange', { detail: next }));
  return true;
}
