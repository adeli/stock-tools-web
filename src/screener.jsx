import React from 'react';
import ReactDOM from 'react-dom/client';
import { WORKER_URL } from './app.js';
import { getChangeColor, getWatchlist, addToWatchlist, removeFromWatchlist } from './utils.js';

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
  function freqColor(freq) {
    if (freq === '月配')   return '#93c5fd';
    if (freq === '雙月配') return '#7dd3fc';
    if (freq === '季配')   return '#86efac';
    if (freq === '半年配') return '#fde68a';
    return C.dim;
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

  function StockBadges({ r }) {
    const setup = r.setup;
    const chips = r.chips;
    if (!setup && !chips) return null;

    const badges = [];
    if (setup?.is_short_bounce) {
      badges.push(
        <span key="sb" title="短線低點起漲：強勢股回測短均 + 極度量縮洗盤 + 下影線承接" style={{
          fontSize:10, fontWeight:700, color:'#fb7185',
          background:'rgba(244,63,94,0.15)', border:'1px solid rgba(244,63,94,0.45)',
          borderRadius:4, padding:'1px 5px',
        }}>
          🔥 低點起漲
        </span>
      );
    } else if (setup?.is_pullback_buy) {
      badges.push(
        <span key="pb" style={{
          fontSize:10, fontWeight:700, color:'#4ade80',
          background:'rgba(74,222,128,0.15)', border:'1px solid rgba(74,222,128,0.4)',
          borderRadius:4, padding:'1px 5px',
        }}>
          🎯 {setup.pullback_line || 'SEMA'}買點
        </span>
      );
    }
    if (setup?.is_extended) {
      badges.push(
        <span key="ext" title={`距50MA季線乖離率 +${setup.bias_ma50}%`} style={{
          fontSize:10, fontWeight:700, color:'#fb923c',
          background:'rgba(251,146,60,0.15)', border:'1px solid rgba(251,146,60,0.4)',
          borderRadius:4, padding:'1px 5px',
        }}>
          🚨 乖離過大
        </span>
      );
    }
    if (chips?.it_consec_days >= 2) {
      badges.push(
        <span key="chips" title={`投信近5日買賣超 ${chips.it_net_lots_5d} 張`} style={{
          fontSize:10, fontWeight:700, color:'#facc15',
          background:'rgba(250,204,21,0.15)', border:'1px solid rgba(250,204,21,0.4)',
          borderRadius:4, padding:'1px 5px',
        }}>
          ⭐ 投信連{chips.it_consec_days}買
        </span>
      );
    }
    if (setup?.trend_template) {
      badges.push(
        <span key="trend" title="股價 > 50MA > 200MA 且均線多頭排列" style={{
          fontSize:10, fontWeight:700, color:'#38bdf8',
          background:'rgba(56,189,248,0.12)', border:'1px solid rgba(56,189,248,0.35)',
          borderRadius:4, padding:'1px 5px',
        }}>
          🌊 多頭
        </span>
      );
    }

    if (badges.length === 0) return null;
    return <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>{badges}</div>;
  }

  function MarketRegimeBanner({ regime }) {
    if (!regime) return null;

    const STATUS_CFG = {
      BULL: {
        border: 'rgba(74, 222, 128, 0.4)',
        bg: 'rgba(74, 222, 128, 0.08)',
        badgeColor: '#4ade80',
        icon: '🟢',
      },
      CAUTION: {
        border: 'rgba(251, 191, 36, 0.4)',
        bg: 'rgba(251, 191, 36, 0.08)',
        badgeColor: '#fbbf24',
        icon: '🟡',
      },
      DEFENSIVE: {
        border: 'rgba(249, 115, 22, 0.4)',
        bg: 'rgba(249, 115, 22, 0.08)',
        badgeColor: '#f97316',
        icon: '🟠',
      },
      BEAR: {
        border: 'rgba(248, 113, 113, 0.4)',
        bg: 'rgba(248, 113, 113, 0.08)',
        badgeColor: '#f87171',
        icon: '🔴',
      },
    };

    const cfg = STATUS_CFG[regime.status] || STATUS_CFG.CAUTION;
    const d50 = regime.diff_ma50_pct;

    return (
      <div style={{
        marginBottom: 16,
        padding: '12px 16px',
        borderRadius: 10,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{cfg.icon}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>
              {regime.index_name}
            </span>
            <span style={{ fontSize: 14, fontFamily: 'monospace', color: '#cbd5e1' }}>
              ${regime.price?.toLocaleString()}
            </span>
            {d50 != null && (
              <span style={{
                fontSize: 12,
                fontFamily: 'monospace',
                color: d50 >= 0 ? '#4ade80' : '#f87171',
                background: 'rgba(0,0,0,0.25)',
                padding: '2px 6px',
                borderRadius: 4,
              }}>
                季線偏離 {d50 > 0 ? '+' : ''}{d50}%
              </span>
            )}
          </div>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: cfg.badgeColor,
            border: `1px solid ${cfg.border}`,
            borderRadius: 6,
            padding: '3px 8px',
            background: 'rgba(0,0,0,0.3)',
          }}>
            {regime.level} ({regime.status})
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 8, lineHeight: 1.45, opacity: 0.95 }}>
          {regime.advice}
        </div>
      </div>
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

  function WatchlistButton({ code, name }) {
    const norm = /^\d{4,6}[A-Z]?$/.test(code) ? code + '.TW' : code;
    const [inList, setInList] = useState(() => {
      const list = getWatchlist();
      return list.some(w => (w.code || '').toUpperCase() === norm.toUpperCase());
    });

    useEffect(() => {
      const handler = () => {
        const list = getWatchlist();
        setInList(list.some(w => (w.code || '').toUpperCase() === norm.toUpperCase()));
      };
      window.addEventListener('watchlistchange', handler);
      return () => window.removeEventListener('watchlistchange', handler);
    }, [norm]);

    const toggle = (e) => {
      e.stopPropagation();
      if (inList) {
        removeFromWatchlist(norm);
        setInList(false);
      } else {
        addToWatchlist(norm, name);
        setInList(true);
      }
    };

    return (
      <button onClick={toggle} style={{
        fontSize:13, color: inList ? '#4ade80' : '#fbbf24', background:'none',
        border: `1px solid ${inList ? 'rgba(74,222,128,0.45)' : 'rgba(251,191,36,0.45)'}`,
        borderRadius:6, padding:'5px 12px', cursor:'pointer',
      }}>
        {inList ? '✓ 已在自選' : '⭐ 加入自選'}
      </button>
    );
  }

  function FiveDimCard({ ev }) {
    const [open, setOpen] = useState(false);
    if (!ev) return null;
    const tp = ev.trade_plan;
    const dims = ev.dimensions || {};
    const isBuy = ev.verdict === 'BUY';
    const isWait = ev.verdict === 'WAIT';

    const vColor = isBuy ? '#4ade80' : isWait ? '#facc15' : '#f87171';
    const vBg    = isBuy ? 'rgba(74,222,128,0.12)' : isWait ? 'rgba(250,204,21,0.12)' : 'rgba(248,113,113,0.12)';
    const vBdr   = isBuy ? 'rgba(74,222,128,0.35)' : isWait ? 'rgba(250,204,21,0.35)' : 'rgba(248,113,113,0.35)';

    const lightColor = l => l === 'GREEN' ? '#4ade80' : l === 'YELLOW' ? '#facc15' : '#f87171';

    return (
      <div style={{
        background: 'linear-gradient(180deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.85) 100%)',
        border: '1px solid rgba(96,165,250,0.35)',
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 12,
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <span style={{ fontSize:16 }}>🏆</span>
            <span style={{ fontSize:13, fontWeight:800, color:'#93c5fd', letterSpacing:'0.05em' }}>
              五維實戰決策戰報
            </span>
          </div>
          <div style={{
            fontSize:11, fontWeight:800, color:vColor, background:vBg, border:`1px solid ${vBdr}`,
            borderRadius:20, padding:'2px 10px', display:'flex', alignItems:'center', gap:5,
          }}>
            <span>●</span>
            <span>{ev.verdict_desc}</span>
          </div>
        </div>

        {tp && (
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))',
            gap:8, marginBottom:10,
          }}>
            <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:6, padding:'8px 10px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:'#94a3b8', marginBottom:2 }}>建議進場區間</div>
              <div style={{ fontSize:13, fontWeight:700, fontFamily:'monospace', color:'#f8fafc' }}>
                ${tp.buy_zone ? `${tp.buy_zone[0]} ~ ${tp.buy_zone[1]}` : '—'}
              </div>
            </div>
            <div style={{ background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.22)', borderRadius:6, padding:'8px 10px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:'#fca5a5', marginBottom:2 }}>防守停損線</div>
              <div style={{ fontSize:13, fontWeight:700, fontFamily:'monospace', color:'#f87171' }}>
                ${tp.stop_loss} ({tp.stop_pct}%)
              </div>
            </div>
            <div style={{ background:'rgba(34,197,94,0.05)', border:'1px solid rgba(34,197,94,0.22)', borderRadius:6, padding:'8px 10px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:'#86efac', marginBottom:2 }}>短線目標價</div>
              <div style={{ fontSize:13, fontWeight:700, fontFamily:'monospace', color:'#4ade80' }}>
                ${tp.target_price} (+{tp.target_pct}%)
              </div>
            </div>
            <div style={{ background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.22)', borderRadius:6, padding:'8px 10px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:'#93c5fd', marginBottom:2 }}>風報比 / 建議配置</div>
              <div style={{ fontSize:13, fontWeight:700, fontFamily:'monospace', color:'#38bdf8' }}>
                {tp.rrr}:1 · 倉位 {tp.suggested_position_pct}%
              </div>
            </div>
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6, paddingTop:4, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:6 }}>
            {Object.entries(dims).map(([k, d]) => (
              <span key={k} style={{
                fontSize:10.5, fontWeight:700,
                color: lightColor(d.light),
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${lightColor(d.light)}33`,
                borderRadius:4, padding:'2px 6px',
                display:'inline-flex', alignItems:'center', gap:3,
              }}>
                <span style={{ fontSize:8 }}>●</span>
                <span>{d.name} {d.score}分</span>
              </span>
            ))}
          </div>

          <button onClick={() => setOpen(!open)} style={{
            fontSize:11, color:'#93c5fd', background:'none', border:'none',
            cursor:'pointer', padding:'2px 6px', fontWeight:600,
          }}>
            {open ? '收合診斷 ▲' : '五維深度診斷 ▾'}
          </button>
        </div>

        {open && (
          <div style={{ marginTop:10, paddingTop:10, borderTop:'1px dashed rgba(255,255,255,0.08)', display:'flex', flexDirection:'column', gap:6 }}>
            {Object.entries(dims).map(([k, d]) => (
              <div key={k} style={{
                display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8,
                fontSize:12, padding:'5px 8px', borderRadius:5, background:'rgba(255,255,255,0.02)',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  <span style={{ color: lightColor(d.light), fontSize:9 }}>●</span>
                  <span style={{ fontWeight:700, color:'#e2e8f0', minWidth:60 }}>{d.name}</span>
                  <span style={{ fontSize:10.5, fontFamily:'monospace', color:lightColor(d.light), fontWeight:700 }}>
                    {d.score}分
                  </span>
                </div>
                <div style={{ color:'#94a3b8', fontSize:11.5, textAlign:'right' }}>
                  {d.summary}
                </div>
              </div>
            ))}
          </div>
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
        <FiveDimCard ev={r.eval} />

        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
          <Levels title="壓力" arr={resist}  price={price} dir="up" />
          <Levels title="支撐" arr={support} price={price} dir="down" />
        </div>

        {r.setup?.is_short_bounce && (
          <div style={{
            background:'rgba(244,63,94,0.08)', border:'1px solid rgba(244,63,94,0.3)',
            borderRadius:8, padding:'10px 14px', marginBottom:12,
            display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:15 }}>🔥</span>
              <span style={{ fontSize:13, fontWeight:700, color:'#fda4af' }}>
                短線低點起漲訊號：回測 {r.setup.pullback_line} 支撐守穩，量縮洗盤完成，尾盤買盤承接！
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:12, fontFamily:'monospace' }}>
              <span style={{ color:'#4ade80' }}>
                短線目標: <b>${r.setup.target_price || (price * 1.04).toFixed(price>=50?1:2)}</b> (+4%)
              </span>
              <span style={{ color:'#f87171' }}>
                防守停損: <b>${r.setup.stop_loss_price || (price * 0.985).toFixed(price>=50?1:2)}</b> (-1.5%)
              </span>
            </div>
          </div>
        )}

        <div style={{ display:'flex', flexWrap:'wrap', gap:'10px 20px', marginBottom:12 }}>
          <Stat label="45日量比" value={sd.vol45Ratio != null ? `${sd.vol45Ratio}×` : '—'}
                color={sd.vol45Ratio >= 1.5 ? '#4ade80' : C.mid} />
          <Stat label="今日量" value={sd.volLots != null ? `${num(sd.volLots)} 張` : '—'} />
          <Stat label="量能型態" value={WAVE_LABEL[sd.waveState] || '—'} />
          <Stat label="收盤位置" value={sd.closePos != null ? `當日 ${Math.round(sd.closePos * 100)}%` : '—'} />
          <Stat label="60日新高" value={sd.isNewHigh60 ? '是' : '否'}
                color={sd.isNewHigh60 ? '#4ade80' : C.mid} />
          {r.setup?.bias_ma50 != null && (
            <Stat label="50MA乖離" value={`${r.setup.bias_ma50 > 0 ? '+' : ''}${r.setup.bias_ma50}%`}
                  color={r.setup.is_extended ? '#fb923c' : C.mid} />
          )}
          {r.setup?.dist_support_pct != null && (
            <Stat label="支撐線距離" value={`${r.setup.pullback_line || 'SEMA'} (${r.setup.dist_support_pct}%)`}
                  color={r.setup.is_pullback_buy ? '#4ade80' : C.mid} />
          )}
          {r.chips?.it_consec_days > 0 && (
            <Stat label="投信動態" value={`連買 ${r.chips.it_consec_days} 日 (5日 ${r.chips.it_net_lots_5d} 張)`}
                  color="#facc15" />
          )}
          {r.setup?.avg_turnover ? (
            <Stat label="日均成交額" value={
              r.setup.avg_turnover >= 1e8 ? `${(r.setup.avg_turnover / 1e8).toFixed(1)} 億` :
              r.setup.avg_turnover >= 1e6 ? `${(r.setup.avg_turnover / 1e6).toFixed(1)} 百萬` :
              `${r.setup.avg_turnover.toLocaleString()}`
            } />
          ) : null}
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

        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          <button onClick={(e) => { e.stopPropagation(); onFullView(r.code); }} style={{
            fontSize:13, color:'#60a5fa', background:'none',
            border:'1px solid rgba(96,165,250,0.4)', borderRadius:6,
            padding:'5px 12px', cursor:'pointer',
          }}>
            📈 水位計 →
          </button>

          <WatchlistButton code={r.code} name={r.name} />

          <button onClick={(e) => {
            e.stopPropagation();
            const dispSym = r.code.replace(/\.TW$/i, '');
            const inputEl = document.getElementById('symbol');
            if (inputEl) inputEl.value = dispSym;
            if (window.showTab) window.showTab('report');
          }} style={{
            fontSize:13, color:'#c084fc', background:'none',
            border:'1px solid rgba(192,132,252,0.4)', borderRadius:6,
            padding:'5px 12px', cursor:'pointer',
          }}>
            🤖 AI 報告 →
          </button>
        </div>
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
          <StockBadges r={r} />
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
          <div style={{ fontSize:13, fontFamily:'monospace', marginTop:2, color:getChangeColor(chg, r.code) }}>
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
            <div style={{ fontSize:13, fontFamily:'monospace', color:getChangeColor(chg, r.code) }}>
              {chg > 0 ? '+' : ''}{chg?.toFixed(2)}%
            </div>
          </div>
        </div>

        <StockBadges r={r} />

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

  function buildEval(r, setup, chips, regime) {
    if (r.eval) return r.eval;
    const price = r.price || r.sema_data?.price || 0;
    const isTw = (r.code && /^\d+/.test(r.code)) || r.code?.endsWith('.TW') || r.code?.endsWith('.TWO');
    const isEtf = r.source === 'etf';
    const rs = r.rs_rating || 50;

    // 1. 大盤
    const regLevel = regime?.level || 'BULL_STRONG';
    const regDiff = regime?.diff_ma50_pct != null ? regime.diff_ma50_pct : 2.5;
    let mScore = 92, mLight = 'GREEN', mDesc = `大盤強勢多頭 (站穩季線 ${regDiff >= 0 ? '+' : ''}${regDiff}%) · 順風環境適合積極操作`;
    if (regLevel === 'BULL_MILD') {
      mScore = 82; mLight = 'GREEN'; mDesc = `大盤溫和偏多 · 個股多頭排列順勢推進`;
    } else if (regLevel === 'CHOPPY') {
      mScore = 62; mLight = 'YELLOW'; mDesc = `大盤震盪盤整 · 宜縮小部位並嚴格防守`;
    } else if (regLevel === 'BEAR') {
      mScore = 38; mLight = 'RED'; mDesc = `大盤空頭破線 · 系統性風險高，建議觀望`;
    }

    // 2. 價量
    const pLine = setup?.pullback_line || 'SEMA2';
    const distS = setup?.dist_support_pct != null ? setup.dist_support_pct : 2.0;
    const vol45 = r.sema_data?.vol45Ratio || 1.0;
    let tScore = 75, tLight = 'GREEN', tDesc = `多頭排列架構 · 股價站穩關鍵短均`;
    if (setup?.is_short_bounce) {
      tScore = 95; tLight = 'GREEN'; tDesc = `回測 ${pLine} 守穩 (+${distS}%) · 45日量比 ${vol45}× 極致量縮 · 尾盤買盤承接`;
    } else if (setup?.is_pullback_buy) {
      tScore = 88; tLight = 'GREEN'; tDesc = `回測 ${pLine} 支撐 (+${distS}%) · 均線多頭排列穩健`;
    } else if (setup?.is_extended) {
      tScore = 55; tLight = 'YELLOW'; tDesc = `正乖離偏大 (+${setup?.bias_ma50}%) · 追高風險高，等待拉回`;
    }

    // 3. 籌碼
    let cScore = 70, cLight = 'YELLOW', cDesc = `籌碼平穩維持常態`;
    if (isTw && !isEtf) {
      const itDays = chips?.it_consec_days || 0;
      const itLots = chips?.it_net_lots_5d || 0;
      if (itDays >= 5 || chips?.is_it_hot) {
        cScore = 94; cLight = 'GREEN'; cDesc = `投信連買 ${itDays} 天 (5日累計 ${itLots.toLocaleString()} 張) · 主力大戶積極認養`;
      } else if (itDays >= 3) {
        cScore = 85; cLight = 'GREEN'; cDesc = `投信連買 ${itDays} 天 · 籌碼沉澱集中，法人穩步建倉`;
      } else if (itDays >= 1) {
        cScore = 75; cLight = 'GREEN'; cDesc = `投信微幅買超 · 法人籌碼偏多保護`;
      }
    } else {
      if (rs >= 88) {
        cScore = 92; cLight = 'GREEN'; cDesc = `RS評級 ${rs} · 機構高度持股之市場頂尖領頭羊`;
      } else if (rs >= 80) {
        cScore = 84; cLight = 'GREEN'; cDesc = `RS評級 ${rs} · 動能超越全市場 80% 標的`;
      }
    }

    // 4. 基本動能
    const gp = r.eps?.growth_pct;
    const yp = r.dividend?.yield_pct;
    let fScore = 75, fLight = 'GREEN', fDesc = `營運維持常態水準`;
    if (gp != null && gp >= 25) {
      fScore = 90; fLight = 'GREEN'; fDesc = `EPS 年增率 +${gp}% (高成長動能) · 獲利加速爆發`;
    } else if (gp != null && gp > 0) {
      fScore = 80; fLight = 'GREEN'; fDesc = `EPS 年增率 +${gp}% · 基本面維持穩健正向擴張`;
    } else if (yp != null && yp >= 4.5) {
      fScore = 86; fLight = 'GREEN'; fDesc = `預估現金殖利率 ${yp}% · 高股息防禦下檔保護`;
    } else if (isEtf) {
      fScore = 82; fLight = 'GREEN'; fDesc = `指數型商品 · 分散單一持股營運風險`;
    }

    // 5. 風報比
    const stopLoss = setup?.stop_loss_price || Number((price * 0.985).toFixed(price >= 50 ? 1 : 2));
    const targetPrice = setup?.target_price || Number((price * 1.055).toFixed(price >= 50 ? 1 : 2));
    const stopPct = Number(((stopLoss - price) / (price || 1) * 100).toFixed(1));
    const targetPct = Number(((targetPrice - price) / (price || 1) * 100).toFixed(1));
    const rrr = Number(Math.abs(targetPct / (stopPct || -1.5)).toFixed(1));

    let rScore = 85, rLight = 'GREEN', rDesc = `風報比 ${rrr}:1 · 承擔 ${stopPct}% 風險博取 +${targetPct}%`;
    if (rrr >= 2.5) {
      rScore = 94; rLight = 'GREEN';
    } else if (rrr < 1.8) {
      rScore = 65; rLight = 'YELLOW';
      rDesc = `風報比 ${rrr}:1 · 建議拉回至更貼近支撐位再進場`;
    }

    const buyMin = Number((price * 0.992).toFixed(price >= 50 ? 1 : 2));
    const buyMax = Number((price * 1.005).toFixed(price >= 50 ? 1 : 2));

    const lights = [mLight, tLight, cLight, fLight, rLight];
    const greenCount = lights.filter(l => l === 'GREEN').length;
    const totalScore = Math.round(mScore*0.2 + tScore*0.25 + cScore*0.2 + fScore*0.15 + rScore*0.2);

    let verdict = 'BUY', verdictDesc = `建議分批買進 (${greenCount}/5 綠燈 · 評分 ${totalScore})`;
    let posPct = 25;
    if (greenCount >= 4 && totalScore >= 80) {
      verdict = 'BUY'; posPct = regLevel === 'BULL_STRONG' ? 25 : 15;
    } else if (greenCount >= 3 && totalScore >= 70) {
      verdict = 'WAIT'; verdictDesc = `拉回分批布局 (${greenCount}/5 綠燈 · 評分 ${totalScore})`;
      posPct = 15;
    } else {
      verdict = 'AVOID'; verdictDesc = `暫先觀望待變 (${greenCount}/5 綠燈 · 評分 ${totalScore})`;
      posPct = 0;
    }

    return {
      total_score: totalScore,
      passed_lights: greenCount,
      verdict,
      verdict_desc: verdictDesc,
      dimensions: {
        market:      { name: '大盤環境', score: mScore, light: mLight, summary: mDesc },
        technical:   { name: '價量型態', score: tScore, light: tLight, summary: tDesc },
        chips:       { name: '法人籌碼', score: cScore, light: cLight, summary: cDesc },
        fundamental: { name: '基本動能', score: fScore, light: fLight, summary: fDesc },
        risk_reward: { name: '風報比精算', score: rScore, light: rLight, summary: rDesc },
      },
      trade_plan: {
        buy_zone: [buyMin, buyMax],
        stop_loss: stopLoss,
        stop_pct: stopPct,
        target_price: targetPrice,
        target_pct: targetPct,
        rrr,
        suggested_position_pct: posPct,
      }
    };
  }

  function normalizeResult(r, regime) {
    if (!r) return r;
    const sd = r.sema_data || {};
    const price = r.price || sd.price || 0;
    const allSemas = sd.allSemas || [];

    // 若後端已有 setup，直接沿用
    let setup = r.setup;
    if (!setup) {
      const supports = allSemas.filter(s => s.value != null && s.value < price);
      const closest = supports.length > 0
        ? supports.reduce((max, s) => (s.value > max.value ? s : max), supports[0])
        : null;
      const dist = closest ? Number(((price - closest.value) / price * 100).toFixed(2)) : null;
      const pLine = closest?.label || null;

      const s5 = allSemas.find(s => s.label === 'SEMA5');
      const s8 = allSemas.find(s => s.label === 'SEMA8');
      const trend = Boolean(s5 && s8 && price > s5.value && s5.value > s8.value);
      const biasMa50 = s5 ? Number(((price - s5.value) / s5.value * 100).toFixed(1)) : 0;
      const isExtended = biasMa50 >= 25.0;

      const vol45 = sd.vol45Ratio || 1.0;
      const wave = sd.waveState;
      const closePos = sd.closePos != null ? sd.closePos : 0.5;

      const isPb = Boolean(
        (r.rs_rating >= 80) &&
        !isExtended &&
        ['SEMA1', 'SEMA2', 'SEMA3', 'SEMA4', 'SEMA5'].includes(pLine) &&
        dist != null && dist <= 3.5 &&
        (r.changePct == null || r.changePct >= -4.0)
      );

      const isSb = Boolean(
        (r.rs_rating >= 80) &&
        !isExtended &&
        ['SEMA1', 'SEMA2', 'SEMA3'].includes(pLine) &&
        dist != null && dist <= 3.0 &&
        (r.changePct == null || r.changePct >= -3.5) &&
        (vol45 <= 0.85 || ['C', 'D'].includes(wave)) &&
        closePos >= 0.50
      );

      const targetPrice = Number((price * 1.04).toFixed(price >= 50 ? 1 : 2));
      const stopPrice   = Number((price * 0.985).toFixed(price >= 50 ? 1 : 2));

      setup = {
        is_pullback_buy:  isPb,
        is_short_bounce:  isSb,
        target_price:     targetPrice,
        stop_loss_price:  stopPrice,
        pullback_line:    pLine,
        dist_support_pct: dist,
        is_extended:      isExtended,
        bias_ma50:        biasMa50,
        trend_template:   trend,
        avg_turnover:     0,
      };
    }

    const chips = r.chips || {
      it_consec_days: 0,
      it_net_lots_5d: 0,
      it_latest_lots: 0,
      is_it_hot: false,
    };

    const evalData = r.eval || buildEval(r, setup, chips, regime);

    return { ...r, setup, chips, eval: evalData };
  }

  function MarketSection({ market, data, loading, error, onView }) {
    const isMobile = useIsMobile();
    const [expanded, setExpanded] = useState(null);
    const [filter, setFilter] = useState('all');
    const onToggle = code => setExpanded(c => (c === code ? null : code));
    const label = market === 'tw' ? '台股' : '美股';
    const regime  = data?.market_regime;
    const rawResults = data?.results || [];
    const results = rawResults.map(r => normalizeResult(r, regime));
    const scanAt  = fmtDate(data?.scanned_at);
    const hasStock = results.some(r => r.source !== 'etf');
    const hasEtf   = results.some(r => r.source === 'etf');
    const legendMeta = [
      ...(hasStock ? SIGNAL_META_STOCK : []),
      ...(hasEtf ? SIGNAL_META_ETF.filter(m => !(hasStock && SIGNAL_META_STOCK.some(s => s.key === m.key))) : []),
    ];

    const countAll = results.length;
    const countBounce = results.filter(r => r.setup?.is_short_bounce).length;
    const countPb = results.filter(r => r.setup?.is_pullback_buy).length;
    const countChips = results.filter(r => (r.chips?.it_consec_days >= 3) || r.chips?.is_it_hot).length;
    const countTrend = results.filter(r => r.setup?.trend_template).length;

    const filteredResults = results.filter(r => {
      if (filter === 'bounce') return r.setup?.is_short_bounce;
      if (filter === 'pullback') return r.setup?.is_pullback_buy;
      if (filter === 'chips') return (r.chips?.it_consec_days >= 3) || r.chips?.is_it_hot;
      if (filter === 'trend') return r.setup?.trend_template;
      return true;
    });

    const filterButtons = [
      { key: 'all',      label: `全部 (${countAll})` },
      { key: 'bounce',   label: `🔥 低點起漲 (${countBounce})` },
      { key: 'pullback', label: `🎯 回測買點 (${countPb})` },
      ...(market === 'tw' ? [{ key: 'chips', label: `⭐ 投信連買 (${countChips})` }] : []),
      { key: 'trend',    label: `🌊 多頭排列 (${countTrend})` },
    ];

    return (
      <div style={{ marginBottom:28 }}>
        <MarketRegimeBanner regime={regime} />

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

        {results.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
            {filterButtons.map(btn => {
              const active = filter === btn.key;
              return (
                <button
                  key={btn.key}
                  onClick={() => setFilter(btn.key)}
                  style={{
                    fontSize:12,
                    fontWeight: active ? 700 : 500,
                    color: active ? '#60a5fa' : C.dim,
                    background: active ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
                    border: active ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius:16,
                    padding:'4px 12px',
                    cursor:'pointer',
                    transition:'all 0.15s ease',
                  }}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        )}

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

          {!loading && !error && results.length > 0 && filteredResults.length === 0 && (
            <div style={{ padding:40, textAlign:'center', color:C.dim, fontSize:14 }}>
              目前無符合「{filterButtons.find(b => b.key === filter)?.label}」的股票
            </div>
          )}

          {filteredResults.length > 0 && (
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
              {filteredResults.map((r,i) => (
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

  const COLS_SHORT = '28px minmax(0,1.2fr) 48px 80px 105px 95px 95px 115px';
  const COLS_LONG  = '28px minmax(0,1.2fr) 48px 80px 70px 85px 105px 125px';

  function EtfMarketBadge({ isTw }) {
    return (
      <span style={{
        fontSize:10, fontWeight:700,
        color: isTw ? '#38bdf8' : '#c084fc',
        background: isTw ? 'rgba(56,189,248,0.12)' : 'rgba(192,132,252,0.12)',
        border: `1px solid ${isTw ? 'rgba(56,189,248,0.35)' : 'rgba(192,132,252,0.35)'}`,
        borderRadius:4, padding:'1px 4px', verticalAlign:'middle', marginLeft:6,
      }}>
        {isTw ? '台股' : '美股'}
      </span>
    );
  }

  function evalEtf(r, mode) {
    const isTw = /^\d{4,6}[A-Z]?$/.test(r.code);
    const p = r.price || r.sema_data?.price || 0;
    const sd = r.sema_data || {};
    const allSemas = sd.allSemas || [];

    const supports = allSemas.filter(s => s.value != null && s.value < p);
    const closest = supports.length > 0
      ? supports.reduce((max, s) => (s.value > max.value ? s : max), supports[0])
      : null;
    const dist = closest ? Number(((p - closest.value) / p * 100).toFixed(1)) : (r.setup?.dist_support_pct ?? 999.0);
    const line = closest?.label || r.setup?.pullback_line || 'SEMA1';

    const s8 = allSemas.find(s => s.label === 'SEMA8');
    const ma200_dist = s8 ? Number(((p - s8.value) / s8.value * 100).toFixed(1)) : null;

    if (mode === 'short') {
      const targetPrice = Number((p * 1.035).toFixed(p < 50 ? 2 : 1));
      const stopPrice = Number((p * 0.985).toFixed(p < 50 ? 2 : 1));
      let status = { text: '⏸ 離支撐過遠', color: '#94a3b8', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', score: 3 };
      if (dist <= 2.5 && (r.changePct == null || r.changePct >= -3.5)) {
        status = { text: '🎯 觸底回測點', color: '#4ade80', bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.4)', score: 1 };
      } else if (dist <= 5.0) {
        status = { text: '⚡ 蓄勢觀察', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.4)', score: 2 };
      }
      return {
        ...r,
        isTw,
        dist,
        line,
        targetPrice,
        stopPrice,
        status,
      };
    } else {
      const d = r.dividend;
      const freq = d?.freq || (['JEPI','JEPQ'].includes(r.code) ? '月配' : '季配');
      const yieldPct = d?.yield_pct ?? (
        r.code === 'SCHD' ? 3.5 :
        r.code === 'JEPI' ? 8.2 :
        r.code === 'JEPQ' ? 9.5 :
        r.code === 'VYM'  ? 3.0 :
        r.code === 'VOO'  ? 1.4 : null
      );

      let status = { text: '✓ 定期定額 (合理)', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.4)', score: 2 };
      if (s8 && p < s8.value) {
        status = { text: '⚠️ 破年線觀望', color: '#f87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.4)', score: 4 };
      } else if (dist <= 2.0 || (r.setup?.bias_ma50 != null && r.setup.bias_ma50 < 3.0)) {
        status = { text: '⭐ 便宜加碼點', color: '#4ade80', bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.4)', score: 1 };
      } else if (r.setup?.is_extended) {
        status = { text: '⏸ 偏高暫停加碼', color: '#fb923c', bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.4)', score: 3 };
      }

      return {
        ...r,
        isTw,
        dist,
        line,
        freq,
        yieldPct,
        ma200_dist,
        status,
      };
    }
  }

  function EtfShortDesktopRow({ r, rank, onClick, expanded }) {
    const chg = r.changePct;
    return (
      <div onClick={onClick} className="glass-hover" style={{
        display:'grid', gridTemplateColumns:COLS_SHORT, alignItems:'center',
        gap:10, padding:'12px 16px',
        borderBottom:'1px solid rgba(255,255,255,0.06)', cursor:'pointer',
        background: expanded ? 'rgba(96,165,250,0.08)' : undefined,
      }}>
        <div style={{ fontSize:13, color:C.dim, fontFamily:'monospace', textAlign:'right' }}>{rank}</div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.hi, lineHeight:1.2, display:'flex', alignItems:'center', gap:6 }}>
            <Chevron open={expanded} />{r.code}<EtfMarketBadge isTw={r.isTw} />
          </div>
          <div style={{ fontSize:13, color:C.mid, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:18, fontWeight:900, fontFamily:'monospace', color:rsColor(r.rs_rating) }}>{r.rs_rating}</div>
          <div style={{ fontSize:11, color:C.mid, marginTop:1 }}>RS</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:15, fontWeight:700, fontFamily:'monospace', color:C.hi }}>{r.price}</div>
          <div style={{ fontSize:12, fontFamily:'monospace', color:getChangeColor(chg, r.code) }}>
            {chg > 0 ? '+' : ''}{chg?.toFixed(2)}%
          </div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:13, fontWeight:700, fontFamily:'monospace', color:'#38bdf8' }}>{r.line}</div>
          <div style={{ fontSize:11, color:C.mid }}>距 {r.dist}%</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color:'#4ade80' }}>${r.targetPrice}</div>
          <div style={{ fontSize:10, color:'#4ade80' }}>+3.5% 目標</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color:'#f87171' }}>${r.stopPrice}</div>
          <div style={{ fontSize:10, color:'#f87171' }}>-1.5% 防守</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <span style={{
            fontSize:11, fontWeight:700,
            color: r.status.color, background: r.status.bg, border: `1px solid ${r.status.border}`,
            borderRadius:6, padding:'3px 8px', display:'inline-block',
          }}>
            {r.status.text}
          </span>
        </div>
      </div>
    );
  }

  function EtfShortMobileCard({ r, rank, onClick, expanded }) {
    const chg = r.changePct;
    return (
      <div onClick={onClick} className="glass-hover" style={{
        padding:'14px 16px',
        borderBottom:'1px solid rgba(255,255,255,0.06)', cursor:'pointer',
        background: expanded ? 'rgba(96,165,250,0.08)' : undefined,
      }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, minWidth:0 }}>
            <span style={{ fontSize:12, color:C.dim, fontFamily:'monospace', flexShrink:0 }}>{rank}</span>
            <div style={{ minWidth:0 }}>
              <Chevron open={expanded} />{' '}
              <span style={{ fontSize:17, fontWeight:800, color:C.hi }}>{r.code}</span>
              <EtfMarketBadge isTw={r.isTw} />
              <span style={{ fontSize:13, color:C.mid, marginLeft:6,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                display:'inline-block', maxWidth:120, verticalAlign:'middle' }}>
                {r.name}
              </span>
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:16, fontWeight:700, fontFamily:'monospace', color:C.hi }}>{r.price}</div>
            <div style={{ fontSize:13, fontFamily:'monospace', color:getChangeColor(chg, r.code) }}>
              {chg > 0 ? '+' : ''}{chg?.toFixed(2)}%
            </div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10, flexWrap:'wrap', gap:6 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:12, color:C.label }}>支撐: <span style={{ color:'#38bdf8', fontFamily:'monospace', fontWeight:700 }}>{r.line} ({r.dist}%)</span></span>
            <span style={{ fontSize:12, color:C.dim }}>RS: <b style={{ color:rsColor(r.rs_rating) }}>{r.rs_rating}</b></span>
          </div>
          <span style={{
            fontSize:11, fontWeight:700,
            color: r.status.color, background: r.status.bg, border: `1px solid ${r.status.border}`,
            borderRadius:6, padding:'2px 7px',
          }}>
            {r.status.text}
          </span>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
          <div style={{ background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.25)', borderRadius:6, padding:'5px 8px', textAlign:'center' }}>
            <span style={{ fontSize:10, color:C.label }}>預估短線目標(+3.5%)</span>
            <div style={{ fontSize:13, fontWeight:700, fontFamily:'monospace', color:'#4ade80' }}>${r.targetPrice}</div>
          </div>
          <div style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:6, padding:'5px 8px', textAlign:'center' }}>
            <span style={{ fontSize:10, color:C.label }}>防守停損(-1.5%)</span>
            <div style={{ fontSize:13, fontWeight:700, fontFamily:'monospace', color:'#f87171' }}>${r.stopPrice}</div>
          </div>
        </div>
      </div>
    );
  }

  function EtfLongDesktopRow({ r, rank, onClick, expanded }) {
    const chg = r.changePct;
    return (
      <div onClick={onClick} className="glass-hover" style={{
        display:'grid', gridTemplateColumns:COLS_LONG, alignItems:'center',
        gap:10, padding:'12px 16px',
        borderBottom:'1px solid rgba(255,255,255,0.06)', cursor:'pointer',
        background: expanded ? 'rgba(96,165,250,0.08)' : undefined,
      }}>
        <div style={{ fontSize:13, color:C.dim, fontFamily:'monospace', textAlign:'right' }}>{rank}</div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.hi, lineHeight:1.2, display:'flex', alignItems:'center', gap:6 }}>
            <Chevron open={expanded} />{r.code}<EtfMarketBadge isTw={r.isTw} />
          </div>
          <div style={{ fontSize:13, color:C.mid, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:18, fontWeight:900, fontFamily:'monospace', color:rsColor(r.rs_rating) }}>{r.rs_rating}</div>
          <div style={{ fontSize:11, color:C.mid, marginTop:1 }}>RS</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:15, fontWeight:700, fontFamily:'monospace', color:C.hi }}>{r.price}</div>
          <div style={{ fontSize:12, fontFamily:'monospace', color:getChangeColor(chg, r.code) }}>
            {chg > 0 ? '+' : ''}{chg?.toFixed(2)}%
          </div>
        </div>
        <div style={{ textAlign:'center' }}>
          <span style={{ fontSize:12, fontWeight:700, color:freqColor(r.freq) }}>{r.freq}</span>
        </div>
        <div style={{ textAlign:'center' }}>
          {r.yieldPct != null ? (
            <div style={{ fontSize:15, fontWeight:700, fontFamily:'monospace', color:yieldColor(r.yieldPct) }}>
              {r.yieldPct}%
            </div>
          ) : <span style={{ color:C.label }}>—</span>}
        </div>
        <div style={{ textAlign:'center' }}>
          {r.ma200_dist != null ? (
            <div style={{ fontSize:13, fontWeight:700, fontFamily:'monospace', color: r.ma200_dist >= 0 ? '#4ade80' : '#f87171' }}>
              {r.ma200_dist > 0 ? '+' : ''}{r.ma200_dist}%
            </div>
          ) : <span style={{ color:C.label }}>—</span>}
        </div>
        <div style={{ textAlign:'center' }}>
          <span style={{
            fontSize:11, fontWeight:700,
            color: r.status.color, background: r.status.bg, border: `1px solid ${r.status.border}`,
            borderRadius:6, padding:'3px 8px', display:'inline-block',
          }}>
            {r.status.text}
          </span>
        </div>
      </div>
    );
  }

  function EtfLongMobileCard({ r, rank, onClick, expanded }) {
    const chg = r.changePct;
    return (
      <div onClick={onClick} className="glass-hover" style={{
        padding:'14px 16px',
        borderBottom:'1px solid rgba(255,255,255,0.06)', cursor:'pointer',
        background: expanded ? 'rgba(96,165,250,0.08)' : undefined,
      }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, minWidth:0 }}>
            <span style={{ fontSize:12, color:C.dim, fontFamily:'monospace', flexShrink:0 }}>{rank}</span>
            <div style={{ minWidth:0 }}>
              <Chevron open={expanded} />{' '}
              <span style={{ fontSize:17, fontWeight:800, color:C.hi }}>{r.code}</span>
              <EtfMarketBadge isTw={r.isTw} />
              <span style={{ fontSize:13, color:C.mid, marginLeft:6,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                display:'inline-block', maxWidth:120, verticalAlign:'middle' }}>
                {r.name}
              </span>
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:16, fontWeight:700, fontFamily:'monospace', color:C.hi }}>{r.price}</div>
            <div style={{ fontSize:13, fontFamily:'monospace', color:getChangeColor(chg, r.code) }}>
              {chg > 0 ? '+' : ''}{chg?.toFixed(2)}%
            </div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10, flexWrap:'wrap', gap:6 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
            <span style={{ fontSize:12, fontWeight:700, color:freqColor(r.freq) }}>{r.freq}</span>
            <span style={{ fontSize:16, fontWeight:800, fontFamily:'monospace', color:yieldColor(r.yieldPct) }}>
              {r.yieldPct != null ? `${r.yieldPct}%` : '—'}
            </span>
            <span style={{ fontSize:11, color:C.label }}>年化殖利</span>
          </div>
          <span style={{
            fontSize:11, fontWeight:700,
            color: r.status.color, background: r.status.bg, border: `1px solid ${r.status.border}`,
            borderRadius:6, padding:'2px 7px',
          }}>
            {r.status.text}
          </span>
        </div>

        <div style={{ marginTop:8, fontSize:12, color:C.dim, background:'rgba(255,255,255,0.03)', padding:'4px 8px', borderRadius:5, display:'flex', justifyContent:'space-between' }}>
          <span>距年線(200MA)位置:</span>
          <span style={{ fontFamily:'monospace', fontWeight:700, color: r.ma200_dist >= 0 ? '#4ade80' : '#f87171' }}>
            {r.ma200_dist != null ? `${r.ma200_dist > 0 ? '+' : ''}${r.ma200_dist}%` : '—'}
          </span>
        </div>
      </div>
    );
  }

  const CORE_US_ETFS_DEF = [
    { code: 'TQQQ', name: 'ProShares 納指3倍做多', rs_rating: 85 },
    { code: 'SOXL', name: 'Direxion 半導體3倍做多', rs_rating: 99 },
    { code: 'QLD',  name: 'ProShares 納指2倍做多', rs_rating: 64 },
    { code: 'SSO',  name: 'ProShares 標普2倍做多', rs_rating: 57 },
    { code: 'UPRO', name: 'ProShares 標普3倍做多', rs_rating: 71 },
    { code: 'NVDL', name: 'GraniteShares 輝達2倍做多', rs_rating: 65 },
    { code: 'SMH',  name: 'VanEck 半導體 ETF', rs_rating: 92 },
    { code: 'QQQ',  name: 'Invesco 納斯達克100 ETF', rs_rating: 50 },
    { code: 'SCHD', name: 'Schwab 美國股息股票 ETF', rs_rating: 78, dividend: { yield_pct: 3.5, freq: '季配' } },
    { code: 'JEPI', name: 'JPMorgan 股票溢價收益 ETF', rs_rating: 45, dividend: { yield_pct: 8.2, freq: '月配' } },
    { code: 'JEPQ', name: 'JPMorgan 納斯達克股票溢價 ETF', rs_rating: 55, dividend: { yield_pct: 9.5, freq: '月配' } },
    { code: 'VYM',  name: 'Vanguard 高股利收益 ETF', rs_rating: 40, dividend: { yield_pct: 3.0, freq: '季配' } },
    { code: 'DGRO', name: 'iShares 核心股息成長 ETF', rs_rating: 48, dividend: { yield_pct: 2.4, freq: '季配' } },
    { code: 'VOO',  name: 'Vanguard 標普500 ETF', rs_rating: 50, dividend: { yield_pct: 1.4, freq: '季配' } },
  ];

  const CORE_TW_ETFS_DEF = [
    { code: '0050',   name: '元大台灣50', rs_rating: 50, dividend: { yield_pct: 1.5, freq: '半年配' } },
    { code: '00631L', name: '元大台灣50正2', rs_rating: 99 },
    { code: '00670L', name: '富邦NASDAQ正2', rs_rating: 60 },
    { code: '00878',  name: '國泰永續高股息', rs_rating: 71, dividend: { yield_pct: 7.1, freq: '季配' } },
    { code: '0056',   name: '元大高股息', rs_rating: 85, dividend: { yield_pct: 8.7, freq: '季配' } },
    { code: '00919',  name: '群益台灣精選高息', rs_rating: 65, dividend: { yield_pct: 10.4, freq: '季配' } },
    { code: '00929',  name: '復華台灣科技優息', rs_rating: 45, dividend: { yield_pct: 8.9, freq: '月配' } },
  ];

  function EtfStrategySection({ mode, tw, us, onView }) {
    const isMobile = useIsMobile();
    const [expanded, setExpanded] = useState(null);
    const [marketFilter, setMarketFilter] = useState('all');
    const onToggle = code => setExpanded(c => (c === code ? null : code));

    const [liveEtfs, setLiveEtfs] = useState({});
    const [liveLoading, setLiveLoading] = useState(false);

    useEffect(() => {
      const currentUsCodes = (us.data?.results || []).map(r => r.code);
      const currentTwCodes = (tw.data?.results || []).map(r => r.code);

      const missingUs = CORE_US_ETFS_DEF.filter(x => !currentUsCodes.includes(x.code)).map(x => x.code);
      const missingTw = CORE_TW_ETFS_DEF.filter(x => !currentTwCodes.includes(x.code)).map(x => `${x.code}.TW`);
      const needed = [...missingUs, ...missingTw];

      if (needed.length > 0 && Object.keys(liveEtfs).length === 0 && !liveLoading) {
        setLiveLoading(true);
        const CHUNK = 10;
        const chunks = [];
        for (let i = 0; i < needed.length; i += CHUNK) chunks.push(needed.slice(i, i + CHUNK));

        Promise.all(
          chunks.map(chunk =>
            fetch(`${WORKER_URL}/sema/batch?symbols=${chunk.map(encodeURIComponent).join(',')}`)
              .then(r => r.json())
              .catch(() => ({}))
          )
        ).then(resList => {
          const merged = Object.assign({}, ...resList);
          setLiveEtfs(merged);
          setLiveLoading(false);
        }).catch(() => setLiveLoading(false));
      }
    }, [us.data, tw.data]);

    const loading = (tw.loading || us.loading) && Object.keys(liveEtfs).length === 0;
    const error   = tw.error || us.error;
    const twRegime = tw.data?.market_regime;
    const usRegime = us.data?.market_regime;

    const allTwResults = [...(tw.data?.results || [])];
    const allUsResults = [...(us.data?.results || [])];

    Object.entries(liveEtfs).forEach(([sym, sema]) => {
      if (!sema || !sema.price) return;
      const isTw = sym.endsWith('.TW');
      const code = isTw ? sym.replace(/\.TW$/i, '') : sym;
      const targetList = isTw ? allTwResults : allUsResults;
      if (!targetList.some(r => r.code === code)) {
        const def = (isTw ? CORE_TW_ETFS_DEF : CORE_US_ETFS_DEF).find(x => x.code === code) || { code, name: code, rs_rating: 60 };
        targetList.push({
          code: def.code,
          name: def.name,
          source: 'etf',
          price: sema.price,
          changePct: sema.changePct,
          rs_rating: def.rs_rating,
          dividend: def.dividend || null,
          sema_data: sema,
        });
      }
    });

    const twEtfs = allTwResults
      .filter(r => r.source === 'etf' || /^(00\d{2,4}[LA]?)$/.test(r.code))
      .map(r => evalEtf(normalizeResult(r, twRegime), mode));

    const usKnown = CORE_US_ETFS_DEF.map(x => x.code);
    const usEtfs = allUsResults
      .filter(r => r.source === 'etf' || usKnown.includes(r.code))
      .map(r => evalEtf(normalizeResult(r, usRegime), mode));

    let pool = [];
    if (marketFilter === 'tw') pool = twEtfs;
    else if (marketFilter === 'us') pool = usEtfs;
    else pool = [...twEtfs, ...usEtfs];

    if (mode === 'short') {
      pool.sort((a, b) => a.status.score - b.status.score || b.rs_rating - a.rs_rating);
    } else {
      pool = pool.filter(r => r.yieldPct != null || !r.code.includes('L'));
      pool.sort((a, b) => a.status.score - b.status.score || (b.yieldPct || 0) - (a.yieldPct || 0));
    }

    const countAll = twEtfs.length + usEtfs.length;
    const countTw  = twEtfs.length;
    const countUs  = usEtfs.length;

    const marketPills = [
      { key: 'all', label: `全部 (${countAll})` },
      { key: 'tw',  label: `🇹🇼 台股 (${countTw})` },
      { key: 'us',  label: `🇺🇸 美股 (${countUs})` },
    ];

    return (
      <div style={{ marginBottom:28 }}>
        {mode === 'short' ? (
          <div style={{
            marginBottom:16, padding:'14px 18px', borderRadius:10,
            background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.35)',
            boxShadow:'0 4px 16px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
              <span style={{ fontSize:18 }}>⚡</span>
              <span style={{ fontSize:16, fontWeight:800, color:'#f1f5f9' }}>ETF 1~2天短線快打策略</span>
            </div>
            <div style={{ fontSize:13, color:'#cbd5e1', lineHeight:1.55 }}>
              專注高流動性與強勢動能 ETF（含槓桿正2/正3），捕捉回測 SEMA 短線支撐、買盤承接的低點反彈機會。<br/>
              <b>操作紀律：持股 1~2 天，以短線目標 (+3.5%) 停利，跌破支撐 (-1.5%) 嚴守停損。</b>
            </div>
          </div>
        ) : (
          <div style={{
            marginBottom:16, padding:'14px 18px', borderRadius:10,
            background:'rgba(250,204,21,0.08)', border:'1px solid rgba(250,204,21,0.35)',
            boxShadow:'0 4px 16px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
              <span style={{ fontSize:18 }}>💰</span>
              <span style={{ fontSize:16, fontWeight:800, color:'#f1f5f9' }}>ETF 長期穩健存股收息策略</span>
            </div>
            <div style={{ fontSize:13, color:'#cbd5e1', lineHeight:1.55 }}>
              專注高配息、高抗跌與優質市值型 ETF，堅持長期股價站在年線 (200MA) 結構之上，拒絕賺股息賠價差。<br/>
              <b>逢均線拉回特價時（⭐ 便宜加碼點）進場殖利率最高；高檔偏貴時維持定期定額。</b>
            </div>
          </div>
        )}

        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
          {marketPills.map(btn => {
            const active = marketFilter === btn.key;
            return (
              <button
                key={btn.key}
                onClick={() => setMarketFilter(btn.key)}
                style={{
                  fontSize:12,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#60a5fa' : C.dim,
                  background: active ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius:16,
                  padding:'4px 12px',
                  cursor:'pointer',
                  transition:'all 0.15s ease',
                }}
              >
                {btn.label}
              </button>
            );
          })}
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
          {!loading && !error && pool.length === 0 && (
            <div style={{ padding:40, textAlign:'center', color:C.dim, fontSize:14 }}>
              目前無符合條件的 ETF
            </div>
          )}
          {pool.length > 0 && (
            <>
              {!isMobile && (
                <div style={{
                  display:'grid',
                  gridTemplateColumns: mode === 'short' ? COLS_SHORT : COLS_LONG,
                  gap:10, padding:'9px 16px',
                  borderBottom:'1px solid rgba(255,255,255,0.08)'
                }}>
                  {(mode === 'short'
                    ? ['#','代號/名稱','RS','現價/漲跌','支撐線(距%)','1~2天目標','防守停損','戰術狀態']
                    : ['#','代號/名稱','RS','現價/漲跌','配息頻率','年化殖利','年線(200MA)','存股評價']
                  ).map((h, i) => (
                    <div key={i} style={{
                      fontSize:11, fontWeight:700, letterSpacing:'0.12em',
                      color:C.label, textTransform:'uppercase',
                      textAlign: i===0 ? 'right' : (i===1||i===3) ? (i===1?'left':'right') : 'center'
                    }}>{h}</div>
                  ))}
                </div>
              )}
              {pool.map((r, i) => {
                const row = mode === 'short'
                  ? (isMobile
                    ? <EtfShortMobileCard r={r} rank={i+1} onClick={() => onToggle(r.code)} expanded={expanded === r.code} />
                    : <EtfShortDesktopRow r={r} rank={i+1} onClick={() => onToggle(r.code)} expanded={expanded === r.code} />)
                  : (isMobile
                    ? <EtfLongMobileCard r={r} rank={i+1} onClick={() => onToggle(r.code)} expanded={expanded === r.code} />
                    : <EtfLongDesktopRow r={r} rank={i+1} onClick={() => onToggle(r.code)} expanded={expanded === r.code} />);
                return (
                  <React.Fragment key={r.code}>
                    {row}
                    {expanded === r.code && <RowDetail r={r} onFullView={onView} />}
                  </React.Fragment>
                );
              })}
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
      if (mkt === 'us') {
        if (!us.data && !us.loading) loadMarket('us');
      } else if (mkt === 'tw') {
        if (!tw.data && !tw.loading) loadMarket('tw');
      } else {
        if (!tw.data && !tw.loading) loadMarket('tw');
        if (!us.data && !us.loading) loadMarket('us');
      }
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
      { key:'us',        label:'美股個股' },
      { key:'tw',        label:'台股個股' },
      { key:'etf_short', label:'⚡ ETF 短線快打' },
      { key:'etf_long',  label:'💰 ETF 長期存股' },
    ];

    return (
      <div>
        {/* Tab bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:16, borderBottom:'1px solid rgba(255,255,255,0.08)', paddingBottom:0 }}>
          <div style={{ display:'flex', gap:0, flexWrap:'wrap' }}>
            {TABS.map(({ key, label }) => (
              <button key={key} onClick={() => switchTab(key)} style={{
                padding:'9px 16px', fontSize:14, fontWeight:700,
                background:'none', border:'none', cursor:'pointer',
                color: active === key ? '#60a5fa' : C.dim,
                borderBottom: active === key ? '2px solid #60a5fa' : '2px solid transparent',
                transition:'color 0.15s, border-color 0.15s',
                letterSpacing:'0.02em',
                whiteSpace:'nowrap',
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

        {/* Active market / strategy */}
        {active === 'us' && <MarketSection market="us" data={us.data} loading={us.loading} error={us.error} onView={onView} />}
        {active === 'tw' && <MarketSection market="tw" data={tw.data} loading={tw.loading} error={tw.error} onView={onView} />}
        {active === 'etf_short' && <EtfStrategySection mode="short" tw={tw} us={us} onView={onView} />}
        {active === 'etf_long' && <EtfStrategySection mode="long" tw={tw} us={us} onView={onView} />}
      </div>
    );
  }

  const root = document.getElementById('screener-root');
  if (root) ReactDOM.createRoot(root).render(<ScreenerPanel />);
})();
