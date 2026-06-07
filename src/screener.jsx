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

  const SIGNAL_META = [
    { key: 'rs_strong',   label: 'RS≥85', title: 'RS Rating ≥ 85' },
    { key: 'eps_25',      label: 'EPS25', title: 'EPS 成長 ≥ 25%' },
    { key: 'eps_accel',   label: 'EPS↑',  title: 'EPS 加速成長' },
    { key: 'near_high',   label: '近高',  title: '接近 52 週高點或創 60 日新高' },
    { key: 'vol_surge',   label: '爆量',  title: '量能爆量（vol45Ratio ≥ 1.5）' },
    { key: 'sema_rising', label: 'SEMA',  title: 'SEMA5 + SEMA8 同時上彎' },
  ];

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
  function fmtDate(iso) {
    if (!iso) return null;
    const d = new Date(iso), p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function SignalDots({ signals }) {
    return (
      <div style={{ display:'flex', gap:4 }}>
        {SIGNAL_META.map(({ key, title }) => (
          <div key={key} title={title} style={{
            width:10, height:10, borderRadius:'50%', flexShrink:0,
            background: signals[key] ? '#60a5fa' : C.dot_off,
          }} />
        ))}
      </div>
    );
  }

  // ── Desktop row（寬螢幕）────────────────────────────────────────────────────
  function DesktopRow({ r, rank, onView }) {
    const gp = r.eps?.growth_pct, accel = r.eps?.accelerating, chg = r.changePct;
    return (
      <div onClick={() => onView(r.code)} className="glass-hover" style={{
        display:'grid', gridTemplateColumns:COLS, alignItems:'center',
        gap:10, padding:'13px 16px',
        borderBottom:'1px solid rgba(255,255,255,0.06)', cursor:'pointer',
      }}>
        <div style={{ fontSize:13, color:C.dim, fontFamily:'monospace', textAlign:'right' }}>{rank}</div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:C.hi, lineHeight:1.2 }}>{r.code}</div>
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
            <div style={{ fontSize:11, color:C.mid, marginTop:2 }}>EPS YoY</div>
          </>) : <div style={{ fontSize:14, color:C.label }}>—</div>}
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
          <SignalDots signals={r.signals} />
          <div style={{ fontSize:11, color:C.mid }}>{r.signals_hit}/6</div>
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
  function MobileCard({ r, rank, onView }) {
    const gp = r.eps?.growth_pct, accel = r.eps?.accelerating, chg = r.changePct;
    return (
      <div onClick={() => onView(r.code)} className="glass-hover" style={{
        padding:'14px 16px',
        borderBottom:'1px solid rgba(255,255,255,0.06)', cursor:'pointer',
      }}>
        {/* 第一行：排名 + 代號 + 名稱 + 價格 */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, minWidth:0 }}>
            <span style={{ fontSize:12, color:C.dim, fontFamily:'monospace', flexShrink:0 }}>{rank}</span>
            <div style={{ minWidth:0 }}>
              <span style={{ fontSize:18, fontWeight:800, color:C.hi }}>{r.code}</span>
              <span style={{ fontSize:13, color:C.mid, marginLeft:7,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                display:'inline-block', maxWidth:140, verticalAlign:'middle' }}>
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
          {gp != null ? (
            <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
              <span style={{ fontSize:15, fontWeight:700, fontFamily:'monospace', color:epsColor(gp) }}>
                {gp > 0 ? '+' : ''}{gp.toFixed(0)}%{accel ? '↑' : ''}
              </span>
              <span style={{ fontSize:11, color:C.mid }}>EPS</span>
            </div>
          ) : (
            <span style={{ fontSize:13, color:C.label }}>EPS —</span>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:'auto' }}>
            <SignalDots signals={r.signals} />
            <span style={{ fontSize:12, color:C.mid }}>{r.signals_hit}/6</span>
          </div>
        </div>
      </div>
    );
  }

  function ResultRow({ r, rank, onView, isMobile }) {
    return isMobile
      ? <MobileCard   r={r} rank={rank} onView={onView} />
      : <DesktopRow   r={r} rank={rank} onView={onView} />;
  }

  function MarketSection({ market, data, loading, error, onView }) {
    const isMobile = useIsMobile();
    const label = market === 'tw' ? '台股' : '美股';
    const results = data?.results || [];
    const scanAt  = fmtDate(data?.scanned_at);
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
                  {['#','代號','RS','EPS','訊號','價格'].map((h,i) => (
                    <div key={i} style={{ fontSize:11, fontWeight:700, letterSpacing:'0.12em',
                      color:C.label, textTransform:'uppercase',
                      textAlign: i===0 ? 'right' : i>=2 ? 'center' : 'left' }}>{h}</div>
                  ))}
                </div>
              )}
              {results.map((r,i) => <ResultRow key={r.code} r={r} rank={i+1} onView={onView} isMobile={isMobile} />)}
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 16px',
                padding:'10px 16px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                {SIGNAL_META.map(({ key, label, title }) => (
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'#60a5fa', flexShrink:0 }} />
                    <span style={{ fontSize:12, color:C.label }} title={title}>{label}</span>
                  </div>
                ))}
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
