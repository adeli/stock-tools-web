// ── 報告有效期判斷（台股 vs 美股使用不同時區） ──
function tzDateStr(tz, d = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const g = t => p.find(x => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}
function tzTimeStr(tz, d = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const g = t => p.find(x => x.type === t).value;
  return `${g('hour')}:${g('minute')}`;
}
function isReportCurrent(reportDate, isTW) {
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
    return date === etYesterday && tzTimeStr('America/New_York', now) < '16:30';
  }
}
