import React from 'react';
import ReactDOM from 'react-dom/client';

// ── ETF 股利殖利率 Tab ────────────────────────────────────────────────────────

(function () {
  const { useState, useEffect, useCallback } = React;

  function useIsMobile() {
    const get = () => window.innerWidth < 600;
    const [v, setV] = useState(get);
    useEffect(() => {
      const fn = () => setV(get());
      window.addEventListener('resize', fn);
      return () => window.removeEventListener('resize', fn);
    }, []);
    return v;
  }

  const C = {
    hi:    '#f1f5f9',
    mid:   '#e2e8f0',
    dim:   '#cbd5e1',
    label: '#94a3b8',
  };

  // "115年06月24日" → "2026-06-24"
  function parseCnRocDate(s) {
    if (!s) return null;
    const m = s.match(/^(\d+)年(\d{1,2})月(\d{1,2})日/);
    if (!m) return null;
    const y = parseInt(m[1], 10);
    if (y < 80 || y > 200) return null;
    return `${y + 1911}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }

  function yieldColor(y) {
    if (y >= 10) return '#4ade80';
    if (y >=  7) return '#86efac';
    if (y >=  4) return '#fde68a';
    return C.mid;
  }

  // 從除息月份的眾數間隔判斷頻率（比筆數推算更準確）
  function detectFreq(divs) {
    const months = [...new Set(divs.map(d => d.date.slice(0, 7)))].sort();
    if (months.length < 2) return '年配';
    const gaps = [];
    for (let i = 1; i < months.length; i++) {
      const [y1, m1] = months[i - 1].split('-').map(Number);
      const [y2, m2] = months[i].split('-').map(Number);
      const g = (y2 - y1) * 12 + (m2 - m1);
      if (g > 0 && g <= 13) gaps.push(g);
    }
    if (!gaps.length) return '年配';
    const cnt = {};
    for (const g of gaps) cnt[g] = (cnt[g] || 0) + 1;
    const mode = +Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
    if (mode <= 1) return '月配';
    if (mode === 2) return '雙月配';
    if (mode <= 4) return '季配';
    if (mode <= 7) return '半年配';
    return '年配';
  }

  const FREQ_PPY = { '月配': 12, '雙月配': 6, '季配': 4, '半年配': 2, '年配': 1 };

  // 優先用近 12 個月實際加總；資料不足時退回 avgPay × ppy 推算
  function calcAnnual(divs, ppy) {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const paid = divs.filter(d => !d.pending && d.amt > 0);
    const trailing = paid.filter(d => d.date >= cutoffStr);

    if (trailing.length >= ppy) {
      const sum = parseFloat(trailing.reduce((s, d) => s + d.amt, 0).toFixed(4));
      return { annual: sum, isEstimate: false };
    }
    // 資料不足，推算
    const avg = paid.length ? paid.reduce((s, d) => s + d.amt, 0) / paid.length : 0;
    return { annual: parseFloat((avg * ppy).toFixed(4)), isEstimate: true };
  }

  function freqColor(freq) {
    if (freq === '月配')   return '#93c5fd';
    if (freq === '雙月配') return '#7dd3fc';
    if (freq === '季配')   return '#86efac';
    if (freq === '半年配') return '#fde68a';
    return C.dim;
  }

  // 從證交所抓近 14 個月 ETF 配息公告（startDate/endDate 支援歷史資料）
  async function loadDividendData() {
    const now   = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - 14);
    const fmt = d =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const url = `https://www.twse.com.tw/rwd/zh/ETF/etfDiv?response=json&startDate=${fmt(start)}&endDate=${fmt(now)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.status !== 'ok') throw new Error(`TWSE: ${json.status}`);
    return json;
  }

  // 抓全市場收盤價（TWSE STOCK_DAY_ALL 回傳 CSV）
  // CSV 欄位：日期[0] 代號[1] 名稱[2] 成交股數[3] 成交金額[4] 開盤[5] 最高[6] 最低[7] 收盤[8] 漲跌[9] 成交筆數[10]
  async function loadPrices(codes) {
    const codeSet = new Set(codes);
    const map = {};
    try {
      const r = await fetch(
        'https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL',
        { cache: 'no-store' }
      );
      if (!r.ok) return map;
      const text = await r.text();
      const lines = text.trim().split('\n').slice(1); // 跳過表頭
      for (const line of lines) {
        const cols = line.split(',').map(c => c.replace(/[\r"]/g, '').trim());
        const code  = cols[1];
        const price = parseFloat(cols[8]);
        if (codeSet.has(code) && price > 0) map[code] = price;
      }
    } catch (_) {}
    return map;
  }

  // ── 主元件 ──────────────────────────────────────────────────────────────────

  function EtfDividendPage() {
    const isMobile = useIsMobile();
    const [rows,      setRows]      = useState([]);
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState(null);
    const [sort,      setSort]      = useState({ key: 'yieldAnn', dir: -1 });
    const [filter,    setFilter]    = useState('all');
    const [search,    setSearch]    = useState('');
    const [expanded,  setExpanded]  = useState(null);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [dataRange, setDataRange] = useState('');
    const [loaded,    setLoaded]    = useState(false);

    const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const divData = await loadDividendData();

        // 分組 + 解析日期
        const map = {};
        for (const row of divData.data || []) {
          const code  = row[0]?.trim();
          const name  = row[1]?.trim();
          const dateS = row[2]?.trim();
          const amtS  = row[5];
          if (!code || !dateS) continue;
          const date = parseCnRocDate(dateS);
          if (!date) continue;
          const amt = parseFloat(amtS);
          if (!map[code]) map[code] = { code, name, divs: [] };
          if (!isNaN(amt) && amt > 0) {
            map[code].divs.push({ date, amt });
          } else {
            // 已公告但金額未定，仍記錄除息日
            map[code].divs.push({ date, amt: 0, pending: true });
          }
        }

        for (const e of Object.values(map))
          e.divs.sort((a, b) => b.date.localeCompare(a.date));

        // 計算年化配息
        const now = new Date();
        const all_dates = Object.values(map)
          .flatMap(e => e.divs.map(d => d.date))
          .filter(Boolean)
          .sort();

        const firstDate = all_dates[0] ? new Date(all_dates[0]) : new Date(now.getFullYear(), 0, 1);
        const months_covered = Math.max(1,
          (now.getFullYear() - firstDate.getFullYear()) * 12 +
          (now.getMonth() - firstDate.getMonth()) + 1
        );

        setDataRange(`${firstDate.toISOString().slice(0,7).replace('-','年')}月 ～ ${
          now.getFullYear()}年${String(now.getMonth()+1).padStart(2,'0')}月`);

        const etfList = Object.values(map)
          .filter(e => e.divs.some(d => !d.pending))
          .map(e => {
            const paid    = e.divs.filter(d => !d.pending && d.amt > 0);
            const total   = parseFloat(paid.reduce((s, d) => s + d.amt, 0).toFixed(4));
            const paidCnt = paid.length;
            const freq    = detectFreq(e.divs);           // 用間隔眾數判斷
            const ppy     = FREQ_PPY[freq] ?? 1;
            const { annual, isEstimate } = calcAnnual(e.divs, ppy);
            const latest  = paid[0]?.date?.slice(0, 7) ?? '';
            return { ...e, total, annual, isEstimate, freq, latest, cnt: paidCnt };
          })
          .filter(e => e.total > 0);

        const codes  = etfList.map(e => e.code);
        const prices = await loadPrices(codes);

        const final = etfList.map(e => ({
          ...e,
          price:    prices[e.code] ?? null,
          yieldAnn: prices[e.code]
            ? parseFloat(((e.annual / prices[e.code]) * 100).toFixed(2))
            : null,
        }));

        setRows(final);
        setUpdatedAt(new Date());
        setLoaded(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      window.etfDividendLoad = () => { if (!loaded) load(); };
      return () => { window.etfDividendLoad = null; };
    }, [load, loaded]);

    // ── 過濾 + 排序 ──────────────────────────────────────────────────────────
    const displayed = rows
      .filter(e => {
        if (filter === '月配' && !['月配','雙月配'].includes(e.freq)) return false;
        if (filter === '季配' && e.freq !== '季配') return false;
        if (filter === '年配' && !['年配','半年配'].includes(e.freq)) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!e.code.toLowerCase().includes(q) && !e.name.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sort.key === 'code') return sort.dir * a.code.localeCompare(b.code);
        let av = a[sort.key], bv = b[sort.key];
        if (av == null) av = sort.dir > 0 ?  Infinity : -Infinity;
        if (bv == null) bv = sort.dir > 0 ?  Infinity : -Infinity;
        return sort.dir * (av < bv ? -1 : av > bv ? 1 : 0);
      });

    function toggleSort(key) {
      setSort(s => s.key === key ? { key, dir: -s.dir } : { key, dir: -1 });
    }

    // ── 統計摘要 ─────────────────────────────────────────────────────────────
    const withYield = rows.filter(r => r.yieldAnn != null);
    const maxEtf = withYield.length
      ? withYield.reduce((m, r) => (r.yieldAnn > m.yieldAnn ? r : m), withYield[0])
      : null;

    const COLS = '66px minmax(0,1fr) 70px 84px 82px 58px';

    function ColHdr({ k, label, align }) {
      const active = sort.key === k;
      return (
        <div
          onClick={k ? () => toggleSort(k) : undefined}
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', userSelect: 'none',
            color: active ? 'var(--accent)' : C.label,
            cursor: k ? 'pointer' : 'default',
            textAlign: align || 'left',
          }}
        >
          {label}{active ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
        </div>
      );
    }

    // ── 渲染 ─────────────────────────────────────────────────────────────────
    return (
      <div>

        {/* 頂部 toolbar */}
        <div className="glass p-4 mb-3" style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.hi }}>台股 ETF 股利殖利率</div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>
              {updatedAt
                ? `${rows.length} 支 ETF · 資料區間 ${dataRange} · 更新 ${
                    updatedAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`
                : '資料來源：台灣證券交易所'}
            </div>
          </div>
          <button
            onClick={load} disabled={loading}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700,
              border: loading ? '1px solid rgba(255,255,255,0.1)' : 'none',
              background: loading ? 'rgba(255,255,255,0.05)' : 'var(--gradient-btn)',
              color: loading ? C.dim : '#050c1a',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '載入中…' : '↺ 重新整理'}
          </button>
        </div>

        {/* 統計摘要 */}
        {!loading && rows.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'ETF 數量', val: `${rows.length}`, unit: '支', color: C.hi },
              { label: '最高殖利率', val: maxEtf?.code ?? '—', sub: maxEtf ? `${maxEtf.yieldAnn}%` : '', color: maxEtf ? yieldColor(maxEtf.yieldAnn) : C.dim },
            ].map(({ label, val, unit='', sub, color }) => (
              <div key={label} className="glass" style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.label, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color }}>{val}{unit}</div>
                {sub && <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color, marginTop: 1 }}>{sub}</div>}
              </div>
            ))}
          </div>
        )}

        {/* 篩選列 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
          {[['all','全部'],['月配','月配'],['季配','季配'],['年配','年/半年配']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{
              padding: '5px 11px', borderRadius: 6, fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
              background: filter === v ? 'var(--accent-a15)' : 'transparent',
              border: `1px solid ${filter === v ? 'var(--accent-a45)' : 'rgba(255,255,255,0.1)'}`,
              color: filter === v ? 'var(--accent)' : C.dim,
            }}>{l}</button>
          ))}
          <input
            type="text" placeholder="搜尋代號 / 名稱" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'rgba(4,8,22,0.7)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: '5px 12px', color: C.hi, fontSize: 13,
              outline: 'none', width: 160,
            }}
          />
          {displayed.length > 0 && (
            <span style={{ fontSize: 12, color: C.label, marginLeft: 4 }}>{displayed.length} 支</span>
          )}
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <div className="glass p-4" style={{ color: '#f87171' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>載入失敗：{error}</div>
            <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.7 }}>
              可能原因：網路問題、VPN / 海外 IP 被擋，或瀏覽器 CORS 限制（twse.com.tw 僅開放台灣 IP）。<br />
              請關閉 VPN 後重新整理，或改用 Chrome / Edge 瀏覽器。
            </div>
          </div>
        )}

        {/* 載入中 */}
        {loading && (
          <div className="glass" style={{ padding: 56, textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 14px' }} />
            <div style={{ fontSize: 14, color: C.dim }}>從證交所載入 ETF 配息資料…</div>
            <div style={{ fontSize: 12, color: C.label, marginTop: 6 }}>通常需要 3–6 秒</div>
          </div>
        )}

        {/* 尚未載入 */}
        {!loading && !error && !loaded && (
          <div className="glass" style={{ padding: 56, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💰</div>
            <div style={{ fontSize: 15, color: C.mid, fontWeight: 600 }}>點擊「重新整理」載入最新資料</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>
              或切換至此頁面時自動載入
            </div>
          </div>
        )}

        {/* 主表格 */}
        {!loading && !error && rows.length > 0 && (
          <div className="glass" style={{ overflowX: 'auto' }}>

            {/* 表頭（桌機） */}
            {!isMobile && (
              <div style={{
                display: 'grid', gridTemplateColumns: COLS,
                padding: '10px 16px', gap: 8,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                minWidth: 500,
              }}>
                <ColHdr k="code"     label="代號"      />
                <ColHdr k="name"     label="名稱"      />
                <ColHdr k="price"    label="現價"    align="right" />
                <ColHdr k="annual"   label="年化配息" align="right" />
                <ColHdr k="yieldAnn" label="年化殖利率" align="right" />
                <ColHdr k={null}     label="頻率"    align="right" />
              </div>
            )}

            {/* 排序列（手機） */}
            {isMobile && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}>
                <span style={{ fontSize: 12, color: C.label, flexShrink: 0 }}>排序</span>
                <select
                  value={sort.key}
                  onChange={ev => setSort({ key: ev.target.value, dir: ev.target.value === 'code' ? 1 : -1 })}
                  style={{
                    flex: 1, background: 'rgba(4,8,22,0.7)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                    padding: '6px 10px', color: C.hi, fontSize: 13, outline: 'none',
                  }}
                >
                  <option value="yieldAnn">年化殖利率</option>
                  <option value="annual">年化配息</option>
                  <option value="price">現價</option>
                  <option value="code">代號</option>
                </select>
                <button
                  onClick={() => setSort(s => ({ ...s, dir: -s.dir }))}
                  style={{
                    flexShrink: 0, background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                    padding: '6px 12px', color: C.mid, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {sort.dir > 0 ? '↑ 由小到大' : '↓ 由大到小'}
                </button>
              </div>
            )}

            {displayed.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: C.dim }}>
                沒有符合條件的 ETF
              </div>
            )}

            {displayed.map(e => {
              const isExp = expanded === e.code;
              const pendingDivs = e.divs.filter(d => d.pending);
              return (
                <div key={e.code}>
                  {isMobile ? (
                    <div
                      onClick={() => setExpanded(isExp ? null : e.code)}
                      className="glass-hover"
                      style={{
                        padding: '13px 16px',
                        borderBottom: `1px solid rgba(255,255,255,${isExp ? '0.1' : '0.05'})`,
                        cursor: 'pointer',
                        background: isExp ? 'rgba(96,165,250,0.04)' : 'transparent',
                      }}
                    >
                      {/* 第一行：代號 + 頻率 */}
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: C.hi }}>{e.code}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: freqColor(e.freq), flexShrink: 0 }}>{e.freq}</span>
                      </div>
                      {/* 第二行：完整名稱（可換行，不截斷） */}
                      <div style={{ fontSize: 13, color: C.mid, lineHeight: 1.45, marginTop: 3 }}>
                        {e.name.replace(/基金$/, '').trim()}
                      </div>
                      {/* 第三行：現價 / 年化配息 / 年化殖利率 */}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, color: C.label }}>
                          現價 <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: C.hi }}>
                            {e.price != null ? e.price.toFixed(2) : '—'}
                          </span>
                        </span>
                        <span style={{ fontSize: 13, color: C.label }}>
                          配息 <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: C.mid }}>
                            {e.annual > 0 ? e.annual.toFixed(4) : '—'}
                          </span>
                        </span>
                        <span style={{ fontSize: 13, color: C.label }}>
                          殖利率 {e.yieldAnn != null
                            ? <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 900, color: yieldColor(e.yieldAnn) }}>{e.yieldAnn.toFixed(2)}%</span>
                            : <span style={{ color: C.label }}>—</span>}
                        </span>
                      </div>
                    </div>
                  ) : (
                  <div
                    onClick={() => setExpanded(isExp ? null : e.code)}
                    className="glass-hover"
                    style={{
                      display: 'grid', gridTemplateColumns: COLS,
                      alignItems: 'center', padding: '12px 16px', gap: 8,
                      borderBottom: `1px solid rgba(255,255,255,${isExp ? '0.1' : '0.05'})`,
                      cursor: 'pointer', minWidth: 500,
                      background: isExp ? 'rgba(96,165,250,0.04)' : 'transparent',
                    }}
                  >
                    <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 800, color: C.hi }}>{e.code}</div>
                    <div style={{ fontSize: 13, color: C.mid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.name.replace(/基金$/, '').trim()}
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: C.hi }}>
                      {e.price != null ? e.price.toFixed(2) : <span style={{ color: C.label }}>—</span>}
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: C.mid }}>
                      {e.annual > 0 ? e.annual.toFixed(4) : <span style={{ color: C.label }}>—</span>}
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 17, fontWeight: 900 }}>
                      {e.yieldAnn != null
                        ? <span style={{ color: yieldColor(e.yieldAnn) }}>{e.yieldAnn.toFixed(2)}%</span>
                        : <span style={{ color: C.label }}>—</span>
                      }
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: freqColor(e.freq) }}>
                      {e.freq}
                    </div>
                  </div>
                  )}

                  {/* 展開：配息歷史 */}
                  {isExp && (
                    <div style={{
                      padding: '12px 20px 16px 26px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(0,0,0,0.22)',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.label, marginBottom: 10 }}>
                        近期配息記錄（{e.cnt} 次已公告，除息日）
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {e.divs.filter(d => !d.pending).map((d, i) => (
                          <div key={i} style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 8, padding: '6px 12px', minWidth: 110,
                          }}>
                            <div style={{ fontSize: 11, color: C.label }}>{d.date.slice(0, 7)}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: C.hi, marginTop: 2 }}>
                              $ {d.amt.toFixed(4)}
                            </div>
                          </div>
                        ))}
                        {pendingDivs.length > 0 && pendingDivs.map((d, i) => (
                          <div key={`p${i}`} style={{
                            background: 'rgba(250,204,21,0.05)',
                            border: '1px solid rgba(250,204,21,0.15)',
                            borderRadius: 8, padding: '6px 12px', minWidth: 110,
                          }}>
                            <div style={{ fontSize: 11, color: '#fde68a' }}>{d.date.slice(0, 7)}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#fde68a', marginTop: 2 }}>
                              待公告
                            </div>
                          </div>
                        ))}
                      </div>
                      {e.annual > 0 && (
                        <div style={{ marginTop: 10, fontSize: 12, color: C.dim }}>
                          {e.isEstimate
                            ? `推算（資料不足）：平均每次 × ${FREQ_PPY[e.freq] ?? 1} →`
                            : '近 12 個月實際加總 →'}
                          {' '}<span style={{ color: C.hi, fontWeight: 700 }}>{e.annual.toFixed(4)}</span> 元/年
                          {e.isEstimate && <span style={{ color: '#fde68a', marginLeft: 6 }}>估算</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {displayed.length > 0 && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)',
                fontSize: 11, color: C.label, lineHeight: 1.7 }}>
                點擊任一列展開近期配息詳情 ·
                年化殖利率 = 近 12 個月配息加總 ÷ 即時股價（資料不足者改用平均推算）
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: 11, color: C.label, marginTop: 14, textAlign: 'center', lineHeight: 1.9 }}>
          ⚠ 殖利率為依近期配息頻率推算之年化估算值，僅供比較參考，不構成投資建議。<br />
          股利資料來源：台灣證券交易所 ETF 配息公告。股價為即時報價或前日收盤。
        </div>
      </div>
    );
  }

  const root = document.getElementById('etf-dividend-root');
  if (root) ReactDOM.createRoot(root).render(<EtfDividendPage />);
})();
