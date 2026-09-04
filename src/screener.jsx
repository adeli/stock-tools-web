import React from 'react';
import ReactDOM from 'react-dom/client';
import { WORKER_URL } from './app.js';

// ── Screener Tab ──────────────────────────────────────────────────────────────


// ── Component ─────────────────────────────────────────────────────────────────
(function () {
  const { useState, useEffect, useCallback, useSyncExternalStore } = React;

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

  // 個股訊號（後端 batch.py 個股路徑產生的 5 個）
  const SIGNAL_META_STOCK = [
    { key: 'rs_strong',   label: 'RS≥85', title: 'RS Rating ≥ 85' },
    { key: 'eps_25',      label: 'EPS25', title: 'EPS 成長 ≥ 25%' },
    { key: 'eps_accel',   label: 'EPS↑',  title: 'EPS 加速成長' },
    { key: 'near_high',   label: '近高',  title: '接近 52 週高點或創 60 日新高' },
    { key: 'vol_surge',   label: '爆量',  title: '量能爆量（vol45Ratio ≥ 1.5）' },
  ];
  // ETF 訊號（無 EPS，改用價量 / 均線型）
  const SIGNAL_META_ETF = [
    { key: 'rs_strong',   label: 'RS≥85', title: 'RS Rating ≥ 85（ETF 獨立成池計算）' },
    { key: 'near_high',   label: '近高',  title: '接近 52 週高點或創 60 日新高' },
    { key: 'vol_surge',   label: '爆量',  title: '量能爆量（vol45Ratio ≥ 1.5）' },
    { key: 'trend_up',    label: '站均',  title: '股價站上 SEMA3 持穩 ≥ 3 日' },
    { key: 'sema_rising', label: 'SEMA',  title: 'SEMA1 + SEMA2 同時上彎' },
  ];
  const metaFor = r => (r && r.source === 'etf' ? SIGNAL_META_ETF : SIGNAL_META_STOCK);

  const COLS = '28px minmax(0,1fr) 54px 76px 70px 84px';

  // 顏色常數 — 改這裡就能全頁換色
  const C = {
    hi:       '#f1f5f9',   // 最亮：股票代號、價格
    mid:      '#e2e8f0',   // 次亮：股票名稱、RS/EPS標籤、訊號數
    dim:      '#cbd5e1',   // 中性：排名、掃描統計、資料日期、重整按鈕
    label:    '#94a3b8',   // 欄標題、圖例
    dot_off:  'rgba(255,255,255,0.25)',  // 未命中訊號點
  };

  function rsColor(rs) {
    if (rs >= 90) return '#4ade80';
    if (rs >= 80) return '#86efac';
    if (rs >= 70) return '#fde68a';
    return C.mid;
  }
  function changeColor(v) {
    if (v > 0) return '#4ade80';
    if (v < 0) return '#f87171';
    return C.dim;
  }
  function epsColor(gp) {
    if (gp >= 25) return '#4ade80';
    if (gp > 0)   return '#86efac';
    return '#f87171';
  }
  function yieldColor(y) {
    if (y >= 6) return '#4ade80';
    if (y >= 4) return '#86efac';
    if (y >= 2) return '#fde68a';
    return C.mid;
  }
  const FREQ_SHORT = { '月配':'月', '雙月配':'雙月', '季配':'季', '半年配':'半年', '年配':'年' };
  function fmtDate(iso) {
    if (!iso) return null;
    const d = new Date(iso), p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function SignalDots({ signals, meta = SIGNAL_META_STOCK }) {
    return (
      <div style={{ display:'flex', gap:4 }}>
        {meta.map(({ key, title }) => (
          <div key={key} title={title} style={{
            width:10, height:10, borderRadius:'50%', flexShrink:0,
            background: signals[key] ? '#60a5fa' : C.dot_off,
          }} />
        ))}
      </div>
    );
  }

  function EtfBadge() {
    return (
      <span style={{
        fontSize:10, fontWeight:700, letterSpacing:'0.06em',
        color:'#fbbf24', border:'1px solid rgba(251,191,36,0.5)',
        borderRadius:4, padding:'1px 4px', verticalAlign:'middle',
      }}>ETF</span>
    );
  }

  function Chevron({ open }) {
    return (
      <span style={{ display:'inline-block', fontSize:11, color:C.label, flexShrink:0,
        transform: open ? 'rotate(90deg)' : 'none', transition:'transform 0.15s' }}>▶</span>
    );
  }

  // ── 展開明細（就地展開，資料全來自 result row 內的 sema_data / dividend）───────
  const WAVE_LABEL = { B:'量能正常', C:'量縮打底', D:'量縮後轉強' };

  function Stat({ label, value, color }) {
    return (
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:10, color:C.label, letterSpacing:'0.05em' }}>{label}</div>
        <div style={{ fontSize:13, fontWeight:700, fontFamily:'monospace', color: color || C.mid }}>{value}</div>
      </div>
    );
  }

  function Levels({ title, arr, price, dir }) {
    const pct = v => `${v > price ? '+' : ''}${((v - price) / price * 100).toFixed(1)}%`;
    return (
      <div style={{ display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap' }}>
        <span style={{ fontSize:11, color:C.label, minWidth:30 }}>{title}</span>
        {arr.length ? arr.map(s => (
          <span key={s.label} style={{ fontSize:12, fontFamily:'monospace',
            color: dir === 'up' ? '#f87171' : '#4ade80' }}>
            {s.value}
            <span style={{ color:C.label, fontSize:10 }}> {s.label} {pct(s.value)}</span>
          </span>
        )) : (
          <span style={{ fontSize:12, color:C.label }}>
            {dir === 'up' ? '上方無壓（創高格局）' : '下方無支撐'}
          </span>
        )}
      </div>
    );
  }

  function RowDetail({ r, onFullView }) {
    const sd     = r.sema_data || {};
    const price  = sd.price ?? r.price;
    const semas  = sd.semas || [];
    const resist = semas.filter(s => s.value >= price);
    const support= semas.filter(s => s.value <  price);
    const meta   = metaFor(r);
    const d      = r.dividend;
    const num    = n => (n != null ? n.toLocaleString() : '—');

    return (
      <div style={{ padding:'14px 16px 16px', background:'rgba(255,255,255,0.035)',
        borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
          <Levels title="壓力" arr={resist}  price={price} dir="up" />
          <Levels title="支撐" arr={support} price={price} dir="down" />
        </div>

        <div style={{ display:'flex', flexWrap:'wrap', gap:'10px 20px', marginBottom:12 }}>
          <Stat label="45日量比" value={sd.vol45Ratio != null ? `${sd.vol45Ratio}×` : '—'}
                color={sd.vol45Ratio >= 1.5 ? '#4ade80' : C.mid} />
          <Stat label="今日量" value={sd.volLots != null ? `${num(sd.volLots)} 張` : '—'} />
          <Stat label="量能型態" value={WAVE_LABEL[sd.waveState] || '—'} />
          <Stat label="收盤位置" value={sd.closePos != null ? `當日 ${Math.round(sd.closePos * 100)}%` : '—'} />
          <Stat label="60日新高" value={sd.isNewHigh60 ? '是' : '否'}
                color={sd.isNewHigh60 ? '#4ade80' : C.mid} />
          {sd.prevHigh && (
            <Stat label="上方套牢區" value={`${sd.prevHigh.price}（${num(sd.prevHigh.lots)}張）`} />
          )}
        </div>

        {sd.fibMsg && (
          <div style={{ fontSize:12, color:'#fbbf24', marginBottom:12 }}>⚠ {sd.fibMsg}</div>
        )}

        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 14px', marginBottom: d ? 12 : 14 }}>
          {meta.map(m => (
            <span key={m.key} style={{ fontSize:12, color: r.signals[m.key] ? C.mid : C.label }}
              title={m.title}>
              {r.signals[m.key] ? '✓' : '✗'} {m.label}
            </span>
          ))}
        </div>

        {d && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:'10px 20px', marginBottom:14 }}>
            <Stat label="配息頻率" value={d.freq} />
            <Stat label="年化配息" value={`${d.estimate ? '~' : ''}${d.annual}`} />
            <Stat label="近12月實配" value={`${d.ttm}`} />
            <Stat label="殖利率"
                  value={d.yield_pct != null ? `${d.estimate ? '~' : ''}${d.yield_pct}%` : '—'}
                  color={d.yield_pct != null ? yieldColor(d.yield_pct) : C.mid} />
          </div>
        )}

        <button onClick={(e) => { e.stopPropagation(); onFullView(r.code); }} style={{
          fontSize:13, color:'#60a5fa', background:'none',
          border:'1px solid rgba(96,165,250,0.4)', borderRadius:6,
          padding:'5px 12px', cursor:'pointer',
        }}>
          完整水位計 →
        </button>
      </div>
    );
  }

  // ── Desktop row（寬螢幕）────────────────────────────────────────────────────
  function DesktopRow({ r, rank, onClick, expanded }) {
    const gp = r.eps?.growth_pct, accel = r.eps?.accelerating, chg = r.changePct;
    const meta = metaFor(r), isEtf = r.source === 'etf';
    const yld = r.dividend?.yield_pct, dfreq = FREQ_SHORT[r.dividend?.freq];
    const dEst = r.dividend?.estimate ? '~' : '';
    return (
      <div onClick={onClick} className="glass-hover" style={{
        display:'grid', gridTemplateColumns:COLS, alignItems:'center',
        gap:10, padding:'13px 16px',
        borderBottom:'1px solid rgba(255,255,255,0.06)', cursor:'pointer',
        background: expanded ? 'rgba(96,165,250,0.08)' : undefined,
      }}>
        <div style={{ fontSize:13, color:C.dim, fontFamily:'monospace', textAlign:'right' }}>{rank}</div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:C.hi, lineHeight:1.2, display:'flex', alignItems:'center', gap:6 }}>
            <Chevron open={expanded} />{r.code}{isEtf && <EtfBadge />}
          </div>
          <div style={{ fontSize:13, color:C.mid, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:20, fontWeight:900, fontFamily:'monospace', color:rsColor(r.rs_rating), lineHeight:1.1 }}>{r.rs_rating}</div>
          <div style={{ fontSize:11, color:C.mid, marginTop:2 }}>RS</div>
        </div>
        <div style={{ textAlign:'center' }}>
          {gp != null ? (<>
            <div style={{ fontSize:15, fontWeight:700, fontFamily:'monospace', lineHeight:1.2, color:epsColor(gp) }}>
              {gp > 0 ? '+' : ''}{gp.toFixed(0)}%{accel ? '↑' : ''}
            </div>
            <div style={{ fontSize:11, color:C.mid, marginTop:2 }}>
              EPS YoY{yld != null && <span style={{ color:C.label }}> · 殖 {dEst}{yld}%</span>}
            </div>
          </>) : yld != null ? (<>
            <div style={{ fontSize:15, fontWeight:700, fontFamily:'monospace', lineHeight:1.2, color:yieldColor(yld) }}>
              {dEst}{yld}%
            </div>
            <div style={{ fontSize:11, color:C.mid, marginTop:2 }}>殖利率{dfreq ? ` · ${dfreq}` : ''}</div>
          </>) : <div style={{ fontSize:14, color:C.label }}>—</div>}
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
          <SignalDots signals={r.signals} meta={meta} />
          <div style={{ fontSize:11, color:C.mid }}>{r.signals_hit}/{meta.length}</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:15, fontWeight:700, fontFamily:'monospace', color:C.hi, lineHeight:1.2 }}>{r.price}</div>
          <div style={{ fontSize:13, fontFamily:'monospace', marginTop:2, color:changeColor(chg) }}>
            {chg > 0 ? '+' : ''}{chg?.toFixed(2)}%
          </div>
        </div>
      </div>
    );
  }

  // ── Mobile card（小螢幕）────────────────────────────────────────────────────
  function MobileCard({ r, rank, onClick, expanded }) {
    const gp = r.eps?.growth_pct, accel = r.eps?.accelerating, chg = r.changePct;
    const meta = metaFor(r), isEtf = r.source === 'etf';
    const yld = r.dividend?.yield_pct, dfreq = FREQ_SHORT[r.dividend?.freq];
    const dEst = r.dividend?.estimate ? '~' : '';
    return (
      <div onClick={onClick} className="glass-hover" style={{
        padding:'14px 16px',
        borderBottom:'1px solid rgba(255,255,255,0.06)', cursor:'pointer',
        background: expanded ? 'rgba(96,165,250,0.08)' : undefined,
      }}>
        {/* 第一行：排名 + 代號 + 名稱 + 價格 */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, minWidth:0 }}>
            <span style={{ fontSize:12, color:C.dim, fontFamily:'monospace', flexShrink:0 }}>{rank}</span>
            <div style={{ minWidth:0 }}>
              <Chevron open={expanded} />{' '}
              <span style={{ fontSize:18, fontWeight:800, color:C.hi }}>{r.code}</span>
              {isEtf && <span style={{ marginLeft:6 }}><EtfBadge /></span>}
              <span style={{ fontSize:13, color:C.mid, marginLeft:7,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                display:'inline-block', maxWidth:120, verticalAlign:'middle' }}>
                {r.name}
              </span>
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:16, fontWeight:700, fontFamily:'monospace', color:C.hi }}>{r.price}</div>
            <div style={{ fontSize:13, fontFamily:'monospace', color:changeColor(chg) }}>
              {chg > 0 ? '+' : ''}{chg?.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* 第二行：RS + EPS + 訊號點 */}
        <div style={{ display:'flex', alignItems:'center', gap:16, marginTop:10, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
            <span style={{ fontSize:20, fontWeight:900, fontFamily:'monospace', color:rsColor(r.rs_rating) }}>{r.rs_rating}</span>
            <span style={{ fontSize:11, color:C.mid }}>RS</span>
          </div>
          {gp != null && (
            <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
              <span style={{ fontSize:15, fontWeight:700, fontFamily:'monospace', color:epsColor(gp) }}>
                {gp > 0 ? '+' : ''}{gp.toFixed(0)}%{accel ? '↑' : ''}
              </span>
              <span style={{ fontSize:11, color:C.mid }}>EPS</span>
            </div>
          )}
          {yld != null && (
            <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
              <span style={{ fontSize:15, fontWeight:700, fontFamily:'monospace', color:yieldColor(yld) }}>
                {dEst}{yld}%
              </span>
              <span style={{ fontSize:11, color:C.mid }}>殖利率{dfreq ? `·${dfreq}` : ''}</span>
            </div>
          )}
          {gp == null && yld == null && !isEtf && (
            <span style={{ fontSize:13, color:C.label }}>EPS —</span>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:'auto' }}>
            <SignalDots signals={r.signals} meta={meta} />
            <span style={{ fontSize:12, color:C.mid }}>{r.signals_hit}/{meta.length}</span>
          </div>
        </div>
      </div>
    );
  }

  function ResultRow({ r, rank, isMobile, expanded, onToggle, onFullView }) {
    const row = isMobile
      ? <MobileCard r={r} rank={rank} onClick={() => onToggle(r.code)} expanded={expanded} />
      : <DesktopRow r={r} rank={rank} onClick={() => onToggle(r.code)} expanded={expanded} />;
    return (
      <>
        {row}
        {expanded && <RowDetail r={r} onFullView={onFullView} />}
      </>
    );
  }

  function MarketSection({ market, data, loading, error, onView }) {
    const isMobile = useIsMobile();
    const [expanded, setExpanded] = useState(null);
    const onToggle = code => setExpanded(c => (c === code ? null : code));
    const label = market === 'tw' ? '台股' : '美股';
    const results = data?.results || [];
    const scanAt  = fmtDate(data?.scanned_at);
    const hasStock = results.some(r => r.source !== 'etf');
    const hasEtf   = results.some(r => r.source === 'etf');
    const legendMeta = [
      ...(hasStock ? SIGNAL_META_STOCK : []),
      ...(hasEtf ? SIGNAL_META_ETF.filter(m => !(hasStock && SIGNAL_META_STOCK.some(s => s.key === m.key))) : []),
    ];
    return (
      <div style={{ marginBottom:28 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:10, padding:'0 2px', flexWrap:'wrap', gap:6 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {data && (
              <span style={{ fontSize:13, color:C.dim }}>
                掃 {data.total_scanned} 支 · 通過 <span style={{ color:'#60a5fa', fontWeight:700 }}>{data.passed}</span> 支
              </span>
            )}
          </div>
          {scanAt && <span style={{ fontSize:12, color:C.dim, fontFamily:'monospace' }}>資料日期 {scanAt}</span>}
        </div>

        <div className="glass" style={{ overflow:'hidden' }}>
          {loading && (
            <div style={{ padding:40, textAlign:'center' }}>
              <div className="spinner" style={{ margin:'0 auto 12px' }} />
              <div style={{ fontSize:14, color:C.dim }}>載入中…</div>
            </div>
          )}
          {!loading && error && (
            <div style={{ padding:24, textAlign:'center', color:'#f87171', fontSize:14 }}>載入失敗：{error}</div>
          )}
          {!loading && !error && data && results.length === 0 && (
            <div style={{ padding:40, textAlign:'center', color:C.dim, fontSize:14 }}>
              目前無符合條件的 {label} 股票
              <div style={{ fontSize:12, marginTop:8, color:C.label }}>請先觸發 GitHub Actions 執行選股掃描</div>
            </div>
          )}
          {!loading && !error && !data && (
            <div style={{ padding:40, textAlign:'center', color:C.label, fontSize:14 }}>尚無資料</div>
          )}

          {results.length > 0 && (
            <>
              {!isMobile && (
                <div style={{ display:'grid', gridTemplateColumns:COLS, gap:10, padding:'9px 16px',
                  borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  {['#','代號','RS','EPS/殖利','訊號','價格'].map((h,i) => (
                    <div key={i} style={{ fontSize:11, fontWeight:700, letterSpacing:'0.12em',
                      color:C.label, textTransform:'uppercase',
                      textAlign: i===0 ? 'right' : i>=2 ? 'center' : 'left' }}>{h}</div>
                  ))}
                </div>
              )}
              {results.map((r,i) => (
                <ResultRow key={r.code} r={r} rank={i+1} isMobile={isMobile}
                  expanded={expanded === r.code} onToggle={onToggle} onFullView={onView} />
              ))}
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 16px',
                padding:'10px 16px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                {legendMeta.map(({ key, label, title }) => (
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'#60a5fa', flexShrink:0 }} />
                    <span style={{ fontSize:12, color:C.label }} title={title}>{label}</span>
                  </div>
                ))}
                {hasEtf && (
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em', color:'#fbbf24',
                      border:'1px solid rgba(251,191,36,0.5)', borderRadius:4, padding:'1px 4px' }}>ETF</span>
                    <span style={{ fontSize:12, color:C.label }}>無 EPS，改用價量／均線型訊號</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  function ScreenerPanel() {
    const [active, setActive]     = useState('us');
    const [tw, setTw]             = useState({ data:null, loading:false, error:null });
    const [us, setUs]             = useState({ data:null, loading:false, error:null });
    const [refreshing, setRefreshing] = useState(false);

    const setterOf = m => m === 'tw' ? setTw : setUs;

    const loadMarket = useCallback(async (market) => {
      const setState = setterOf(market);
      setState(s => ({ ...s, loading:true, error:null }));
      try {
        const res  = await fetch(`${WORKER_URL}/screener?market=${market}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setState({ data:json, loading:false, error:null });
      } catch(e) {
        setState(s => ({ ...s, loading:false, error:e.message }));
      }
    }, []);

    // 切換 tab 時，若該市場尚未載入則自動載入
    const switchTab = (mkt) => {
      setActive(mkt);
      const state = mkt === 'tw' ? tw : us;
      if (!state.data && !state.loading) loadMarket(mkt);
    };

    const loadAll = useCallback(() => {
      loadMarket('us');
      loadMarket('tw');
    }, [loadMarket]);

    useEffect(() => {
      window.screenerLoad = loadAll;
      return () => { window.screenerLoad = null; };
    }, [loadAll]);

    const onView = (code) => {
      window.quickSema && window.quickSema(code);
    };

    const onRefresh = async () => {
      setRefreshing(true);
      await Promise.all([ loadMarket('tw'), loadMarket('us') ]);
      setRefreshing(false);
    };

    const TABS = [
      { key:'us', label:'美股選股' },
      { key:'tw', label:'台股選股' },
    ];

    return (
      <div>
        {/* Tab bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:16, borderBottom:'1px solid rgba(255,255,255,0.08)', paddingBottom:0 }}>
          <div style={{ display:'flex', gap:0 }}>
            {TABS.map(({ key, label }) => (
              <button key={key} onClick={() => switchTab(key)} style={{
                padding:'9px 20px', fontSize:15, fontWeight:700,
                background:'none', border:'none', cursor:'pointer',
                color: active === key ? '#60a5fa' : C.dim,
                borderBottom: active === key ? '2px solid #60a5fa' : '2px solid transparent',
                transition:'color 0.15s, border-color 0.15s',
                letterSpacing:'0.02em',
              }}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={onRefresh} disabled={refreshing} style={{
            fontSize:14, color:C.dim, background:'none', border:'none',
            cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.5 : 1,
            paddingBottom:10,
          }}>
            {refreshing ? '載入中…' : '↺ 重新整理'}
          </button>
        </div>

        {/* Active market */}
        {active === 'us' && <MarketSection market="us" data={us.data} loading={us.loading} error={us.error} onView={onView} />}
        {active === 'tw' && <MarketSection market="tw" data={tw.data} loading={tw.loading} error={tw.error} onView={onView} />}
      </div>
    );
  }

  const root = document.getElementById('screener-root');
  if (root) ReactDOM.createRoot(root).render(<ScreenerPanel />);
})();
