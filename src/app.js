import { isReportCurrent } from './utils.js';

// ── Tab switching + Header clock ──

function showTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('[data-tab]').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelectorAll('[data-tab="' + name + '"]').forEach(el => el.classList.add('active'));
  if (name === 'report')       { loadCards(); }
  if (name === 'screener')    { window.screenerLoad && window.screenerLoad(); }
  if (name === 'etf-dividend') { window.etfDividendLoad && window.etfDividendLoad(); }
  window.__activeTab = name;
  window.dispatchEvent(new CustomEvent('tabchange', { detail: name }));
}

(function () {
  const clockEl  = document.getElementById('hdr-clock');
  const marketEl = document.getElementById('hdr-market');
  function tick() {
    const now = new Date(), p2 = n => String(n).padStart(2,'0');
    clockEl.textContent = `${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`;
    const d = now.getUTCDay(), mins = now.getUTCHours()*60 + now.getUTCMinutes();
    const wd = d >= 1 && d <= 5;
    let txt = '休市', col = '#cbd5e1';
    if (wd) {
      if      (mins >= 60  && mins < 330)  { txt = 'TW 開盤'; col = '#22c55e'; }
      else if (mins >= 810 && mins < 1260) { txt = 'US 開盤'; col = '#22c55e'; }
      else                                 { txt = '盤後';    col = '#6366f1'; }
    }
    marketEl.textContent = txt; marketEl.style.color = col;
  }
  tick(); setInterval(tick, 1000);
})();

// ── AI Report + History ──

export const WORKER_URL = 'https://stock-tools.adelitwo.workers.dev';

window.fetchSemaBatch = async function(symbols) {
  const CHUNK = 10;
  const chunks = [];
  for (let i = 0; i < symbols.length; i += CHUNK)
    chunks.push(symbols.slice(i, i + CHUNK));
  const results = await Promise.all(
    chunks.map(chunk =>
      fetch(`${WORKER_URL}/sema/batch?symbols=${chunk.map(encodeURIComponent).join(',')}`)
        .then(r => r.json())
    )
  );
  return Object.assign({}, ...results);
};

const btn               = document.getElementById('generate-btn');
const statusBox         = document.getElementById('status-box');
const reportPlaceholder = document.getElementById('report-placeholder');
const statusText        = document.getElementById('status-text');
const spinner           = document.getElementById('spinner');
const timerEl           = document.getElementById('timer');
const progressSteps     = document.getElementById('progress-steps');
const progressFill      = document.getElementById('progress-fill');
const downloadSection   = document.getElementById('download-section');
const downloadBtn       = document.getElementById('download-btn');

function setSymbol(s) { document.getElementById('symbol').value = s; }

let timerInterval = null;
function startTimer() {
  const t0 = Date.now();
  timerEl.classList.remove('hidden'); timerEl.style.color = 'var(--accent-dim)';
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now()-t0)/1000);
    timerEl.textContent = `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  }, 1000);
}
function stopTimer(color) { clearInterval(timerInterval); timerEl.style.color = color; }

const FILL = ['0%','33%','66%','100%'];
function setStep(n) {
  progressFill.style.width = FILL[n];
  for (let i = 0; i <= 3; i++) {
    const dot = document.getElementById(`dot-${i}`);
    const lbl = document.getElementById(`lbl-${i}`);
    dot.className = 'dot z-10 ';
    if      (i < n)  { dot.className += 'dot-done';   lbl.style.color = '#22c55e'; }
    else if (i === n){ dot.className += 'dot-active'; lbl.style.color = 'var(--accent)'; }
    else             { dot.className += 'dot-idle';   lbl.style.color = '#cbd5e1'; }
  }
}

function renderReports(data) {
  const container = document.getElementById('reports-container');
  if (data.error && !data.reports?.length) {
    container.innerHTML = `<div style="text-align:center;padding:14px;color:#6b7280;font-size: 14px;">無法載入：${data.error}</div>`; return;
  }
  const reports = data.reports || [];
  if (!reports.length) {
    container.innerHTML = `<div style="text-align:center;padding:14px;color:#cbd5e1;font-size: 15px;">尚無報告</div>`; return;
  }
  container.innerHTML = reports.map(r => {
    const openBtn = r.html_link ? `<a href="${r.html_link}" target="_blank" style="font-size: 15px;font-weight:700;color:#4ade80;text-decoration:none;" onmouseover="this.style.opacity=0.65" onmouseout="this.style.opacity=1">開啟 →</a>` : '';
    const dlBtn   = r.pdf_link  ? `<a href="${r.pdf_link}"  target="_blank" style="font-size: 15px;font-weight:700;color:#cbd5e1;text-decoration:none;" onmouseover="this.style.opacity=0.65" onmouseout="this.style.opacity=1">PDF ↓</a>` : '';
    return `<div class="glass glass-hover" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;margin-bottom:8px;gap:8px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
        <span style="font-size: 16px;font-weight:900;color:#f1f5f9;flex-shrink:0;">${r.symbol}</span>
        <span style="font-size: 14px;color:#cbd5e1;font-family:monospace;white-space:nowrap;">${r.date}</span>
      </div>
      <div style="display:flex;align-items:center;gap:14px;flex-shrink:0;">${openBtn}${dlBtn}</div>
    </div>`;
  }).join('');
}

async function loadReports() {
  const container = document.getElementById('reports-container');
  container.innerHTML = `<div style="text-align:center;padding:20px;color:#cbd5e1;font-size: 15px;">載入中...</div>`;
  try {
    renderReports(await fetch(`${WORKER_URL}/reports`).then(r => r.json()));
  } catch { container.innerHTML = `<div style="text-align:center;padding:14px;color:#6b7280;font-size: 14px;">載入失敗，請稍後再試</div>`; }
}

function normalizeSymbol(raw) {
  const s = raw.trim().toUpperCase();
  return /^\d{4}$/.test(s) ? s + '.TW' : s;
}

btn.addEventListener('click', async () => {
  const symbol = normalizeSymbol(document.getElementById('symbol').value);
  if (!symbol) { alert('請輸入股票代碼'); return; }
  btn.disabled = true; btn.textContent = '送出中...';
  reportPlaceholder.style.display = 'none';
  statusBox.classList.remove('hidden');
  progressSteps.classList.remove('hidden');
  downloadSection.classList.add('hidden');
  spinner.classList.remove('hidden');
  setStep(0); startTimer();
  statusText.textContent = '正在送出請求...';
  try {
    const genRes = await fetch(`${WORKER_URL}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol })
    });
    if (!genRes.ok) throw new Error(await genRes.text());
    const { job_id } = await genRes.json();
    setStep(1); statusText.textContent = '佇列等待中...';
    const poll = setInterval(async () => {
      let data;
      try { data = await fetch(`${WORKER_URL}/status?job_id=${job_id}`).then(r => r.json()); } catch { return; }
      if (data.status === 'in_progress') { setStep(2); statusText.textContent = '分析進行中...'; }
      else if (data.status === 'success') {
        clearInterval(poll); stopTimer('#22c55e'); spinner.classList.add('hidden');
        setStep(3); statusText.textContent = '✅ 分析完成！';
        downloadBtn.href = data.drive_link;
        downloadBtn.textContent = '開啟報告';
        downloadSection.classList.remove('hidden');
        btn.disabled = false; btn.textContent = '產生報告';
        setTimeout(async () => {
          try {
            const rData = await fetch(`${WORKER_URL}/reports`).then(r => r.json());
            const sym = symbol.replace(/\.TW$/i, '').toUpperCase();
            const match = (rData.reports || []).find(r => r.symbol.toUpperCase() === sym);
            if (match?.html_link) {
              downloadBtn.href = match.html_link;
              downloadBtn.textContent = '開啟報告';
            }
            renderReports(rData);
          } catch { loadReports(); }
        }, 3000);
      } else if (data.status === 'failure') {
        clearInterval(poll); stopTimer('#ef4444'); spinner.classList.add('hidden');
        const reason = (data.conclusion && data.conclusion !== 'failure') ? `（${data.conclusion}）` : '';
        statusText.textContent = `❌ 分析失敗${reason}，請稍後再試`;
        btn.disabled = false; btn.textContent = '產生報告';
      }
    }, 30000);
  } catch(e) {
    stopTimer('#ef4444'); spinner.classList.add('hidden');
    statusText.textContent = '發生錯誤：' + e.message;
    btn.disabled = false; btn.textContent = '產生報告';
  }
});

function sparkline(prices, w, h) {
  if (!prices || prices.length < 2) return '';
  const min = Math.min(...prices), max = Math.max(...prices), range = max-min||1;
  const pts = prices.map((p,i) => `${(i/(prices.length-1)*w).toFixed(1)},${(h-(p-min)/range*h).toFixed(1)}`).join(' ');
  const up = prices[prices.length-1] >= prices[0];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;">
    <polyline points="${pts}" fill="none" stroke="${up?'#22c55e':'#ef4444'}" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

function getSignalTag(c) {
  const v = c.verdict || (typeof c.trade_strategy === 'object' ? c.trade_strategy?.action : '');
  if (v === 'BUY')     return { label:'看多', c:'#22c55e', bg:'rgba(34,197,94,0.1)',  bd:'rgba(34,197,94,0.25)' };
  if (v === 'SELL')    return { label:'看空', c:'#ef4444', bg:'rgba(239,68,68,0.1)', bd:'rgba(239,68,68,0.25)' };
  if (v === 'NEUTRAL') return { label:'觀望', c:'var(--accent)', bg:'var(--accent-a08)', bd:'var(--accent-a25)' };
  return null;
}

async function loadCards() {
  const container = document.getElementById('cards-container');
  const reportsContainer = document.getElementById('reports-container');
  container.innerHTML = `<div style="text-align:center;padding:16px;color:#cbd5e1;font-size: 15px;">載入中...</div>`;
  reportsContainer.innerHTML = `<div style="text-align:center;padding:20px;color:#cbd5e1;font-size: 15px;">載入中...</div>`;
  try {
    const [data, rData] = await Promise.all([
      fetch(`${WORKER_URL}/cards`).then(r => r.json()),
      fetch(`${WORKER_URL}/reports`).then(r => r.json()).catch(() => ({ reports: [] })),
    ]);
    const reportLinkMap = {};
    for (const r of (rData.reports || [])) {
      if (!reportLinkMap[r.symbol]) {
        const isTW = /^\d{4,6}$/.test(r.symbol);
        if (isReportCurrent(r.date, isTW)) reportLinkMap[r.symbol] = r.html_link;
      }
    }
    const allCards = data.cards || [];
    const cards = allCards.filter(c => isReportCurrent(c.date, /^\d{4,6}$/.test(c.symbol)));
    renderReports(rData);
    if (!cards.length) {
      container.innerHTML = `<div style="text-align:center;padding:14px;color:#cbd5e1;font-size: 15px;">今日尚無分析</div>`; return;
    }
    const dateEl = document.getElementById('cards-date');
    if (dateEl && cards[0]?.date) dateEl.textContent = cards[0].date;

    container.innerHTML = cards.map(c => {
      const tag    = getSignalTag(c);
      const chart  = sparkline(c.prices, 96, 34);
      const tsRaw = c.trade_strategy;
      let tsAction = '', tsReason = '', tsStatus = '', tsAdvice = '';
      if (tsRaw) {
        if (typeof tsRaw === 'string') { tsStatus = tsRaw; }
        else { tsAction = tsRaw.action||''; tsReason = tsRaw.actionReason||''; tsStatus = tsRaw.status||''; tsAdvice = tsRaw.advice||''; }
      }
      const _badgeStyle = { BUY:'background:#7f1d1d;color:#fca5a5;border:1px solid #dc2626', SELL:'background:#14532d;color:#86efac;border:1px solid #16a34a', NEUTRAL:'background:#1e3a5f;color:#93c5fd;border:1px solid #1d4ed8' };
      const tsActionBadge = tsAction ? `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:800;${_badgeStyle[tsAction]||_badgeStyle.NEUTRAL};">${tsAction}</span>` : '';

      const ioRaw  = c.intraday_outlook;
      const ioText = !ioRaw ? '' : String(ioRaw);

      const strategy = (tsStatus||tsAdvice) ? `
        <div style="margin-top:10px;padding:9px 11px;background:var(--accent-a06);border-left:2px solid var(--accent-a40);border-radius:0 6px 6px 0;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--accent);margin-bottom:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            操作策略${tsActionBadge}${tsReason?`<span style="font-size:11px;color:#e2e8f0;font-weight:700;">${tsReason}</span>`:''}
          </div>
          ${tsStatus?`<div style="font-size:14px;color:#e2e8f0;line-height:1.6;">${tsStatus}</div>`:''}
          ${tsAdvice?`<div style="font-size:13px;font-weight:700;color:#fde68a;margin-top:4px;">💡 建議：<span style="font-weight:400;color:#fef08a;">${tsAdvice}</span></div>`:''}
        </div>` : '';
      const intraday = ioText ? `
        <div style="margin-top:7px;padding:9px 11px;background:rgba(56,189,248,0.05);border-left:2px solid rgba(56,189,248,0.3);border-radius:0 6px 6px 0;">
          <div style="font-size: 11px;font-weight:700;letter-spacing:0.1em;color:#38bdf8;margin-bottom:3px;">${c.market_state==='POST'?'明日盤勢展望':'今日盤勢展望'}</div>
          <div style="font-size: 14px;color:#e2e8f0;line-height:1.6;">${ioText}</div>
        </div>` : '';

      const isTW = /^\d{4,6}$/.test(c.symbol);
      const zhName = isTW && c.name ? c.name.split(' ')[0] : '';
      const enName = isTW ? (c.name||'').slice(zhName.length).trim() : (c.name||'');
      const logoSym = isTW ? c.symbol + '.TW' : c.symbol;
      const logoUrl = `https://financialmodelingprep.com/image-stock/${logoSym}.png`;

      return `<div class="glass glass-hover" style="padding:14px;">
        ${tag ? `<div style="margin-bottom:9px;"><span style="font-size: 12px;font-weight:800;letter-spacing:0.06em;padding:3px 9px;border-radius:20px;background:${tag.bg};color:${tag.c};border:1px solid ${tag.bd};">${tag.label}</span></div>` : ''}
        <div style="display:flex;align-items:start;justify-content:space-between;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:2px;flex-wrap:wrap;">
              <img src="${logoUrl}" onerror="this.style.display='none'" style="width:22px;height:22px;border-radius:4px;flex-shrink:0;object-fit:contain;">
              <span style="font-size: 18px;font-weight:900;color:#f1f5f9;">${c.symbol}</span>
              ${zhName ? `<span style="font-size:15px;font-weight:700;color:#f1f5f9;">${zhName}</span>` : ''}
              <span style="font-size: 13px;color:#64748b;font-family:monospace;">${c.date}</span>
            </div>
            ${enName ? `<div style="font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${enName}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0;">
            ${c.intraday_prices && c.intraday_prices.length>1
              ? `<div>${sparkline(c.intraday_prices,96,34)}</div><div style="font-size: 11px;color:#cbd5e1;letter-spacing:0.05em;">TODAY 5m</div>`
              : `<div>${chart}</div><div style="font-size: 11px;color:#cbd5e1;letter-spacing:0.05em;">30D</div>`}
            <span style="font-size: 16px;font-weight:800;color:#fde68a;font-family:monospace;">
              ${c.current_price!=null?c.current_price:c.price}<span style="font-size: 12px;color:#cbd5e1;"> ${c.currency}</span>
            </span>
          </div>
        </div>
        ${strategy}${intraday}
        <div style="margin-top:10px;text-align:right;">
          ${(reportLinkMap[c.symbol]||'#') !== '#'
            ? `<a href="${reportLinkMap[c.symbol]}" target="_blank" style="font-size: 13px;font-weight:700;color:var(--accent);text-decoration:none;" onmouseover="this.style.opacity=0.65" onmouseout="this.style.opacity=1">完整報告 →</a>`
            : ''}
        </div>
      </div>`;
    }).join('');
    renderReports(rData);
  } catch {
    container.innerHTML = `<div style="text-align:center;padding:14px;color:#6b7280;font-size: 14px;">載入失敗</div>`;
    reportsContainer.innerHTML = `<div style="text-align:center;padding:14px;color:#6b7280;font-size: 14px;">載入失敗，請稍後再試</div>`;
  }
}

// HTML onclick 屬性呼叫這些函數，需要掛到 window
window.showTab = showTab;
window.loadCards = loadCards;
window.loadReports = loadReports;
window.setSymbol = setSymbol;
