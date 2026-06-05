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
    const etYesterday = tzDateStr('America/New_York', new Date(now - 86400000));
    return date === etYesterday && tzTimeStr('America/New_York', now) < '16:30';
  }
}
