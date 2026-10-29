import React from 'react';
import ReactDOM from 'react-dom/client';
import { WORKER_URL } from './app.js';
import { getChangeColor, getWatchlist, addToWatchlist, removeFromWatchlist } from './utils.js';
import {
  evaluateStockUnified,
  evaluateRrrGrade,
  CORE_US_ETFS_DEF,
  CORE_TW_ETFS_DEF,
  BENCHMARK_TW_STOCKS_DEF,
  BENCHMARK_US_STOCKS_DEF,
} from './stock-evaluator.js';

// ── 方案一：Apple 風格「極簡實戰卡片流」（最不費腦、極度清爽） ─────────────────────

(function () {
  const { useState, useEffect, useCallback, useMemo } = React;

  // 顏色常數
  const C = {
    hi:       '#f8fafc',
    mid:      '#cbd5e1',
    dim:      '#94a3b8',
    dark:     '#64748b',
    border:   'rgba(255, 255, 255, 0.08)',
    borderHover: 'rgba(96, 165, 250, 0.45)',
    cardBg:   'rgba(15, 23, 42, 0.65)',
    cardHover:'rgba(30, 41, 59, 0.75)',
  };

  function fmtDate(iso) {
    if (!iso) return null;
    const d = new Date(iso), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // ── 五維評估與作戰計畫 (統一由 stock-evaluator.js 驅動) ──────────────────────────
  function buildEval(r, setup, chips, regime) {
    if (r.eval) return r.eval;
    const unified = evaluateStockUnified(r, regime);
    return unified.eval;
  }

  function normalizeResult(r, regime) {
    if (!r) return r;
    const unified = evaluateStockUnified(r, regime);
    return {
      ...r,
      isTw: unified.isTw,
      isEtf: unified.isEtf,
      rs_rating: unified.rsRating,
      eps: unified.eps,
      dividend: unified.dividend,
      chips: unified.chips,
      eval: unified.eval,
      ma200_dist: unified.ma200Dist,
      setup: {
        is_pullback_buy: unified.isPb,
        is_short_bounce: unified.isSb,
        pullback_line: unified.pLine,
        dist_support_pct: unified.distS,
        is_extended: unified.isExtended,
        trend_template: unified.trendTemplate,
        target_price: unified.tradePlan.targetPrice,
        stop_loss_price: unified.tradePlan.stopLoss,
      },
    };
  }

  // ── 自選按鈕組件 ─────────────────────────────────────────────────────────────
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
      <button
        onClick={toggle}
        title={inList ? '從自選移除' : '加入自選觀察清單'}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: inList ? '#4ade80' : '#fbbf24',
          background: inList ? 'rgba(74, 222, 128, 0.1)' : 'rgba(251, 191, 36, 0.1)',
          border: `1px solid ${inList ? 'rgba(74, 222, 128, 0.35)' : 'rgba(251, 191, 36, 0.35)'}`,
          borderRadius: 6,
          padding: '4px 10px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          transition: 'all 0.15s ease',
        }}
      >
        <span>{inList ? '✓' : '⭐'}</span>
        <span>{inList ? '已自選' : '自選'}</span>
      </button>
    );
  }

  // ── Apple 風格「極簡實戰卡片」 (ActionCard) ──────────────────────────────────
  function ActionCard({ r, strategy, onView }) {
    const [detailOpen, setDetailOpen] = useState(false);

    const unified = useMemo(() => evaluateStockUnified(r), [r]);
    const isTw = unified.isTw;
    const dispCode = (unified.code || r.code || '').replace(/\.TW$/i, '');
    const price = unified.price || r.price || 0;
    const chg = unified.changePct ?? r.changePct;
    const ev = unified.eval || {};
    const tp = unified.tradePlan || {};
    const badge = unified.badge;
    const rationale = unified.rationale;
    const rrrGrade = unified.rrrGrade;
    const setup = r.setup || {};
    const sd = r.sema_data || {};

    // 實戰數據數值 (Line 3 metrics)
    const isEtfSave = strategy === 'etf_save' || unified.isEtf;
    const buyMin = tp.buyZone ? tp.buyZone[0] : (price * 0.992).toFixed(1);
    const buyMax = tp.buyZone ? tp.buyZone[1] : (price * 1.005).toFixed(1);
    const stopLoss = tp.stopLoss || (price * 0.985).toFixed(1);
    const stopPct = tp.stopPct || -1.5;
    const targetPrice = tp.targetPrice || (price * 1.045).toFixed(1);
    const targetPct = tp.targetPct || +4.5;
    const rrr = tp.rrr || 2.5;

    // ETF 存股數據
    const etfYield = unified.dividend?.yield_pct ?? (
      r.code === 'SCHD' ? 3.5 :
      r.code === 'JEPI' ? 8.2 :
      r.code === 'JEPQ' ? 9.5 :
      r.code === 'VYM'  ? 3.0 :
      r.code === 'VOO'  ? 1.4 : null
    );
    const etfFreq = unified.dividend?.freq || (['JEPI','JEPQ'].includes(dispCode) ? '月配' : '季配');

    const lightColor = l => l === 'GREEN' ? '#4ade80' : l === 'YELLOW' ? '#facc15' : '#f87171';

    return (
      <div
        className="glass-hover"
        style={{
          background: C.cardBg,
          border: `1px solid ${detailOpen ? 'rgba(96, 165, 250, 0.4)' : C.border}`,
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 10,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* LINE 1: 標題列 (代號、名稱、市場、現價、漲跌幅、狀態標籤) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {/* 代號 */}
            <span style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: C.hi, letterSpacing: '0.02em' }}>
              {dispCode}
            </span>

            {/* 市場標籤 */}
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: isTw ? '#38bdf8' : '#c084fc',
                background: isTw ? 'rgba(56, 189, 248, 0.12)' : 'rgba(192, 132, 252, 0.12)',
                border: `1px solid ${isTw ? 'rgba(56, 189, 248, 0.35)' : 'rgba(192, 132, 252, 0.35)'}`,
                borderRadius: 4,
                padding: '1px 5px',
              }}
            >
              {isTw ? '台股' : '美股'}
            </span>

            {/* ETF 標籤 */}
            {r.isEtf && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fbbf24',
                  background: 'rgba(251, 191, 36, 0.12)',
                  border: '1px solid rgba(251, 191, 36, 0.35)',
                  borderRadius: 4,
                  padding: '1px 4px',
                }}
              >
                ETF
              </span>
            )}

            {/* 名稱 */}
            <span
              style={{
                fontSize: 13,
                color: C.dim,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 160,
              }}
            >
              {r.name}
            </span>
          </div>

          {/* 右側：現價 + 漲跌幅 + 決策標籤 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: C.hi, lineHeight: 1.1 }}>
                ${price}
              </div>
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: getChangeColor(chg, r.code), marginTop: 2 }}>
                {chg > 0 ? '+' : ''}{chg != null ? chg.toFixed(2) : '0.00'}%
              </div>
            </div>

            {/* 實戰狀態徽章 */}
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: badge.color,
                background: badge.bg,
                border: `1px solid ${badge.border}`,
                borderRadius: 20,
                padding: '3px 10px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              {badge.text}
            </div>
          </div>
        </div>

        {/* LINE 2: 核心理由一句話 (Rationale) */}
        <div
          style={{
            marginTop: 7,
            marginBottom: 9,
            fontSize: 12.5,
            color: '#e2e8f0',
            lineHeight: 1.45,
            opacity: 0.92,
            letterSpacing: '0.01em',
          }}
        >
          {rationale}
        </div>

        {/* LINE 3: 實戰數據條 + 快捷操作按鈕 */}
        <div
          style={{
            paddingTop: 9,
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {/* 左側：具體數據 Pills */}
          <div className="trade-pills-row" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            {!isEtfSave ? (
              <>
                {/* 建議進場 */}
                <div
                  style={{
                    fontSize: 11.5,
                    fontFamily: 'monospace',
                    color: '#93c5fd',
                    background: 'rgba(96, 165, 250, 0.08)',
                    border: '1px solid rgba(96, 165, 250, 0.22)',
                    borderRadius: 5,
                    padding: '2px 7px',
                  }}
                >
                  <span style={{ color: C.dim, fontSize: 10.5 }}>進場: </span>${buyMin}~{buyMax}
                </div>

                {/* 防守停損 */}
                <div
                  style={{
                    fontSize: 11.5,
                    fontFamily: 'monospace',
                    color: '#f87171',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.22)',
                    borderRadius: 5,
                    padding: '2px 7px',
                  }}
                >
                  <span style={{ color: C.dim, fontSize: 10.5 }}>停損: </span>${stopLoss} ({stopPct}%)
                </div>

                {/* 短線目標 */}
                <div
                  style={{
                    fontSize: 11.5,
                    fontFamily: 'monospace',
                    color: '#4ade80',
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.22)',
                    borderRadius: 5,
                    padding: '2px 7px',
                  }}
                >
                  <span style={{ color: C.dim, fontSize: 10.5 }}>目標: </span>${targetPrice} (+{targetPct}%)
                </div>

                {/* 風報比 */}
                <div
                  title={rrrGrade.tooltip}
                  style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: rrrGrade.color,
                    background: rrrGrade.bg,
                    border: `1px solid ${rrrGrade.border}`,
                    borderRadius: 5,
                    padding: '2px 7px',
                    cursor: 'help',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <span>風報比 {rrr}:1 ({rrrGrade.text})</span>
                  <span style={{ fontSize: 9.5, opacity: 0.65 }}>ⓘ</span>
                </div>
              </>
            ) : (
              <>
                {/* ETF 存股指標 */}
                {etfYield != null && (
                  <div
                    style={{
                      fontSize: 11.5,
                      fontFamily: 'monospace',
                      color: '#4ade80',
                      background: 'rgba(34, 197, 94, 0.08)',
                      border: '1px solid rgba(34, 197, 94, 0.22)',
                      borderRadius: 5,
                      padding: '2px 7px',
                    }}
                  >
                    <span style={{ color: C.dim, fontSize: 10.5 }}>年化殖利: </span>{etfYield}% ({etfFreq})
                  </div>
                )}

                {r.ma200_dist != null && (
                  <div
                    style={{
                      fontSize: 11.5,
                      fontFamily: 'monospace',
                      color: r.ma200_dist >= 0 ? '#38bdf8' : '#f87171',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 5,
                      padding: '2px 7px',
                    }}
                  >
                    <span style={{ color: C.dim, fontSize: 10.5 }}>距年線: </span>
                    {r.ma200_dist > 0 ? '+' : ''}{r.ma200_dist}%
                  </div>
                )}

                {setup.pullback_line && (
                  <div
                    style={{
                      fontSize: 11.5,
                      fontFamily: 'monospace',
                      color: '#facc15',
                      background: 'rgba(250, 204, 21, 0.06)',
                      borderRadius: 5,
                      padding: '2px 6px',
                    }}
                  >
                    支撐: {setup.pullback_line} (+{setup.dist_support_pct}%)
                  </div>
                )}
              </>
            )}
          </div>

          {/* 右側：快速動作按鈕 */}
          <div className="card-action-bar" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <WatchlistButton code={r.code} name={r.name} />

            <button
              onClick={() => onView(r.code)}
              title="查看 SEMA 水位計"
              style={{
                fontSize: 12,
                color: '#60a5fa',
                background: 'rgba(96, 165, 250, 0.08)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                borderRadius: 6,
                padding: '4px 9px',
                cursor: 'pointer',
              }}
            >
              📈 水位計
            </button>

            <button
              onClick={() => {
                const inputEl = document.getElementById('symbol');
                if (inputEl) inputEl.value = dispCode;
                if (window.showTab) window.showTab('report');
              }}
              title="前往 AI 分析報告"
              style={{
                fontSize: 12,
                color: '#c084fc',
                background: 'rgba(192, 132, 252, 0.08)',
                border: '1px solid rgba(192, 132, 252, 0.3)',
                borderRadius: 6,
                padding: '4px 9px',
                cursor: 'pointer',
              }}
            >
              🤖 報告
            </button>

            {/* 極簡收合抽屜開關 */}
            <button
              onClick={() => setDetailOpen(!detailOpen)}
              style={{
                fontSize: 11,
                color: detailOpen ? '#93c5fd' : C.dim,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 6px',
              }}
            >
              {detailOpen ? '收合 ▲' : '診斷 ▾'}
            </button>
          </div>
        </div>

        {/* 展開抽屜：五維決策診斷 (可選展開，不影響主卡片整潔) */}
        {detailOpen && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {ev.dimensions && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 6, marginBottom: 4 }}>
                {Object.entries(ev.dimensions).map(([k, d]) => (
                  <div
                    key={k}
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: `1px solid ${lightColor(d.light)}33`,
                      borderRadius: 6,
                      padding: '5px 8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>{d.name}</span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, color: lightColor(d.light) }}>
                        ● {d.score}分
                      </span>
                    </div>
                    <div style={{ fontSize: 10.5, color: C.dim, lineHeight: 1.35 }}>
                      {d.summary}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 壓力與支撐關卡提示 */}
            {sd.semas && sd.semas.length > 0 && (
              <div style={{ fontSize: 11, color: C.dim, display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                <span>
                  壓力關卡:{' '}
                  {sd.semas.filter(s => s.value >= price).slice(0, 2).map(s => (
                    <b key={s.label} style={{ color: '#f87171', marginRight: 6 }}>{s.label} ${s.value}</b>
                  )) || '上方無實質均線壓力'}
                </span>
                <span>
                  支撐關卡:{' '}
                  {sd.semas.filter(s => s.value < price).slice(0, 2).map(s => (
                    <b key={s.label} style={{ color: '#4ade80', marginRight: 6 }}>{s.label} ${s.value}</b>
                  )) || '下方均線支撐'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── 主面板 (ScreenerPanel) ──────────────────────────────────────────────────
  function ScreenerPanel() {
    // 3 大策略: 'short' (短線快打) | 'trend' (波段強勢) | 'etf_save' (ETF存股)
    const [strategy, setStrategy] = useState('short');
    // 市場過濾: 'all' | 'tw' | 'us'
    const [market, setMarket] = useState('all');

    const [tw, setTw] = useState(() => {
      try {
        const cached = sessionStorage.getItem('screener_tw_data');
        return { data: cached ? JSON.parse(cached) : null, loading: !cached, error: null };
      } catch (_) {
        return { data: null, loading: true, error: null };
      }
    });

    const [us, setUs] = useState(() => {
      try {
        const cached = sessionStorage.getItem('screener_us_data');
        return { data: cached ? JSON.parse(cached) : null, loading: !cached, error: null };
      } catch (_) {
        return { data: null, loading: true, error: null };
      }
    });

    const [liveEtfs, setLiveEtfs] = useState(() => {
      try {
        const cached = sessionStorage.getItem('screener_live_etfs');
        return cached ? JSON.parse(cached) : {};
      } catch (_) {
        return {};
      }
    });

    const [liveLoading, setLiveLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // 載入資料
    const loadMarket = useCallback(async (mkt, force = false) => {
      const setter = mkt === 'tw' ? setTw : setUs;
      setter(s => ({ ...s, loading: true, error: null }));
      try {
        const url = `${WORKER_URL}/screener?market=${mkt}${force ? '&force=1' : ''}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        try {
          sessionStorage.setItem(`screener_${mkt}_data`, JSON.stringify(json));
        } catch (_) {}
        setter({ data: json, loading: false, error: null });
      } catch (e) {
        setter(s => ({ ...s, loading: false, error: e.message }));
      }
    }, []);

    const loadAll = useCallback((force = false) => {
      loadMarket('tw', force);
      loadMarket('us', force);
    }, [loadMarket]);

    useEffect(() => {
      loadAll();
      window.screenerLoad = () => loadAll(true);
      return () => { window.screenerLoad = null; };
    }, [loadAll]);

    // 即時補充核心 ETF 與權值股的 SEMA 批次資料（市場資料到齊後才進行比對補漏）
    useEffect(() => {
      if (!tw.data || !us.data) return;

      const currentUsCodes = new Set((us.data?.results || []).map(r => r.code));
      const currentTwCodes = new Set((tw.data?.results || []).map(r => r.code));

      const missingUs = [
        ...CORE_US_ETFS_DEF.filter(x => !currentUsCodes.has(x.code)).map(x => x.code),
        ...BENCHMARK_US_STOCKS_DEF.filter(x => !currentUsCodes.has(x.code)).map(x => x.code),
      ];
      const missingTw = [
        ...CORE_TW_ETFS_DEF.filter(x => !currentTwCodes.has(x.code)).map(x => `${x.code}.TW`),
        ...BENCHMARK_TW_STOCKS_DEF.filter(x => !currentTwCodes.has(x.code)).map(x => `${x.code}.TW`),
      ];

      // 只挑選 liveEtfs 還沒有的 symbol
      const needed = [...missingUs, ...missingTw].filter(sym => {
        const raw = sym.replace(/\.TW$/i, '');
        return !liveEtfs[sym] && !liveEtfs[raw];
      });

      if (needed.length > 0 && !liveLoading) {
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
          setLiveEtfs(prev => {
            const next = { ...prev, ...merged };
            try { sessionStorage.setItem('screener_live_etfs', JSON.stringify(next)); } catch (_) {}
            return next;
          });
          setLiveLoading(false);
        }).catch(() => setLiveLoading(false));
      }
    }, [us.data, tw.data, liveEtfs, liveLoading]);

    const onRefresh = async () => {
      setRefreshing(true);
      await Promise.all([loadMarket('tw', true), loadMarket('us', true)]);
      setRefreshing(false);
    };

    const onView = (code) => {
      window.quickSema && window.quickSema(code);
    };

    // 資料正規化與池子合併
    const twRegime = tw.data?.market_regime;
    const usRegime = us.data?.market_regime;

    const allTwResults = useMemo(() => {
      const list = [...(tw.data?.results || [])];
      Object.entries(liveEtfs).forEach(([sym, sema]) => {
        if (!sema || !sema.price) return;
        if (sym.endsWith('.TW')) {
          const code = sym.replace(/\.TW$/i, '');
          if (!list.some(r => r.code === code)) {
            const etfDef = CORE_TW_ETFS_DEF.find(x => x.code === code);
            const stockDef = BENCHMARK_TW_STOCKS_DEF.find(x => x.code === code);
            const def = etfDef || stockDef || { code, name: code, rs_rating: 60 };
            const isEtf = Boolean(etfDef || /^(00\d{2,4}[LA]?)$/.test(code));
            list.push({
              code: def.code,
              name: def.name,
              source: isEtf ? 'etf' : 'index',
              isEtf,
              isTw: true,
              price: sema.price,
              changePct: sema.changePct,
              rs_rating: def.rs_rating,
              dividend: def.dividend || null,
              eps: def.eps || null,
              sema_data: sema,
            });
          }
        }
      });
      return list.map(r => normalizeResult(r, twRegime));
    }, [tw.data, liveEtfs, twRegime]);

    const allUsResults = useMemo(() => {
      const list = [...(us.data?.results || [])];
      Object.entries(liveEtfs).forEach(([sym, sema]) => {
        if (!sema || !sema.price) return;
        if (!sym.endsWith('.TW')) {
          const code = sym;
          if (!list.some(r => r.code === code)) {
            const etfDef = CORE_US_ETFS_DEF.find(x => x.code === code);
            const stockDef = BENCHMARK_US_STOCKS_DEF.find(x => x.code === code);
            const def = etfDef || stockDef || { code, name: code, rs_rating: 60 };
            const isEtf = Boolean(etfDef);
            list.push({
              code: def.code,
              name: def.name,
              source: isEtf ? 'etf' : 'index',
              isEtf,
              isTw: false,
              price: sema.price,
              changePct: sema.changePct,
              rs_rating: def.rs_rating,
              dividend: def.dividend || null,
              eps: def.eps || null,
              sema_data: sema,
            });
          }
        }
      });
      return list.map(r => normalizeResult(r, usRegime));
    }, [us.data, liveEtfs, usRegime]);

    // 依策略分類池子（添加穩定排序鍵，防止次要排序打亂重排）
    const { shortPool, trendPool, savePool } = useMemo(() => {
      const fullList = [...allTwResults, ...allUsResults];

      // 1. 短線快打: 個股符合 short_bounce 或支撐 <= 3.5% 且未大跌；ETF (包含槓桿型與核心指數型 0050, 006208, VOO, QQQ 等) 距支撐 <= 3.5%
      const short = fullList.filter(r => {
        const s = r.setup || {};
        if (s.is_short_bounce) return true;
        if (s.is_pullback_buy && s.dist_support_pct != null && s.dist_support_pct <= 3.5 && (r.changePct == null || r.changePct >= -3.5)) return true;
        if (r.isEtf) {
          const isEligibleEtf = ['TQQQ','SOXL','QLD','SSO','UPRO','NVDL','SMH','00631L','00670L','0050','006208','QQQ','VOO','SPY'].includes(r.code);
          if (isEligibleEtf && s.dist_support_pct != null && s.dist_support_pct <= 3.5 && (r.changePct == null || r.changePct >= -4.0)) return true;
        }
        return false;
      }).sort((a, b) => {
        const aSb = a.setup?.is_short_bounce ? 1 : 0;
        const bSb = b.setup?.is_short_bounce ? 1 : 0;
        if (bSb !== aSb) return bSb - aSb;
        const aDist = a.setup?.dist_support_pct ?? 999;
        const bDist = b.setup?.dist_support_pct ?? 999;
        if (Math.abs(aDist - bDist) > 0.001) return aDist - bDist;
        return (a.code || '').localeCompare(b.code || '');
      });

      // 2. 波段強勢: RS >= 80 或是指數型龍頭 (0050, 006208, VOO, QQQ 等) 處於多頭架構
      const trend = fullList.filter(r => {
        if (r.isEtf && ['TQQQ','SOXL','UPRO'].includes(r.code)) return false; // 槓桿歸類在短線
        if (['0050','006208','QQQ','VOO','SPY'].includes(r.code) && (r.setup?.trend_template || (r.setup?.dist_support_pct != null && r.setup.dist_support_pct <= 4.0))) return true;
        return (r.rs_rating >= 80) || (r.setup?.trend_template && r.setup?.is_pullback_buy);
      }).sort((a, b) => {
        const rsDiff = (b.rs_rating || 0) - (a.rs_rating || 0);
        if (rsDiff !== 0) return rsDiff;
        return (a.code || '').localeCompare(b.code || '');
      });

      // 3. ETF 存股: 高股息與優質核心市值型 ETF (排除正2/正3槓桿型)
      const save = fullList.filter(r => {
        if (!r.isEtf) return false;
        if (['TQQQ','SOXL','QLD','SSO','UPRO','NVDL','00631L','00670L'].includes(r.code)) return false;
        return true;
      }).sort((a, b) => {
        const aCheap = (a.setup?.dist_support_pct != null && a.setup.dist_support_pct <= 2.2) ? 1 : 0;
        const bCheap = (b.setup?.dist_support_pct != null && b.setup.dist_support_pct <= 2.2) ? 1 : 0;
        if (bCheap !== aCheap) return bCheap - aCheap;
        const yDiff = (b.dividend?.yield_pct || 0) - (a.dividend?.yield_pct || 0);
        if (Math.abs(yDiff) > 0.001) return yDiff;
        return (a.code || '').localeCompare(b.code || '');
      });

      return { shortPool: short, trendPool: trend, savePool: save };
    }, [allTwResults, allUsResults]);

    // 當前選取策略池
    const activePool = strategy === 'short' ? shortPool : strategy === 'trend' ? trendPool : savePool;

    // 市場過濾
    const displayedResults = useMemo(() => {
      if (market === 'tw') return activePool.filter(r => r.isTw);
      if (market === 'us') return activePool.filter(r => !r.isTw);
      return activePool;
    }, [activePool, market]);

    const countShortTw = shortPool.filter(r => r.isTw).length;
    const countShortUs = shortPool.filter(r => !r.isTw).length;
    const countTrendTw = trendPool.filter(r => r.isTw).length;
    const countTrendUs = trendPool.filter(r => !r.isTw).length;
    const countSaveTw  = savePool.filter(r => r.isTw).length;
    const countSaveUs  = savePool.filter(r => !r.isTw).length;

    const currentTwCount = strategy === 'short' ? countShortTw : strategy === 'trend' ? countTrendTw : countSaveTw;
    const currentUsCount = strategy === 'short' ? countShortUs : strategy === 'trend' ? countTrendUs : countSaveUs;
    const currentAllCount = currentTwCount + currentUsCount;

    const isFirstLoading = (tw.loading || us.loading) && !tw.data && !us.data;
    const isLoading = (tw.loading || us.loading) && displayedResults.length === 0;
    const scanDate = fmtDate(tw.data?.scanned_at || us.data?.scanned_at);

    // 策略按鈕選項
    const STRATEGY_BUTTONS = [
      { key: 'short',    icon: '⚡', title: '短線快打', count: isFirstLoading ? '…' : shortPool.length, desc: '1~2天高勝率起漲' },
      { key: 'trend',    icon: '🌊', title: '波段強勢', count: isFirstLoading ? '…' : trendPool.length, desc: 'RS頂尖動能主流' },
      { key: 'etf_save', icon: '💰', title: 'ETF 存股', count: isFirstLoading ? '…' : savePool.length, desc: '高息穩健長期累積' },
    ];

    const MARKET_BUTTONS = [
      { key: 'all', label: isFirstLoading ? '全部 (…)' : `全部 (${currentAllCount})` },
      { key: 'tw',  label: isFirstLoading ? '🇹🇼 台股 (…)' : `🇹🇼 台股 (${currentTwCount})` },
      { key: 'us',  label: isFirstLoading ? '🇺🇸 美股 (…)' : `🇺🇸 美股 (${currentUsCount})` },
    ];

    return (
      <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 40 }}>
        {/* ── 頂部策略選擇按鈕 (Apple 風格膠囊按鈕) ── */}
        <div
          className="strategy-pills-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            marginBottom: 16,
          }}
        >
          {STRATEGY_BUTTONS.map(btn => {
            const active = strategy === btn.key;
            return (
              <button
                key={btn.key}
                onClick={() => setStrategy(btn.key)}
                style={{
                  background: active
                    ? 'linear-gradient(135deg, rgba(96, 165, 250, 0.22) 0%, rgba(37, 99, 235, 0.16) 100%)'
                    : 'rgba(255, 255, 255, 0.035)',
                  border: active ? '1px solid rgba(96, 165, 250, 0.55)' : `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: active ? '0 4px 18px rgba(37, 99, 235, 0.25)' : 'none',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>{btn.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: active ? '#ffffff' : C.mid }}>
                      {btn.title}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      color: active ? '#93c5fd' : C.dim,
                      background: active ? 'rgba(96, 165, 250, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      padding: '2px 8px',
                      borderRadius: 12,
                    }}
                  >
                    {btn.count}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: active ? '#bfdbfe' : C.dim, paddingLeft: 22 }}>
                  {btn.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── 市場過濾與狀態欄 (Pills & Refresh) ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 14,
            padding: '0 2px',
          }}
        >
          {/* 市場過濾 Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {MARKET_BUTTONS.map(btn => {
              const active = market === btn.key;
              return (
                <button
                  key={btn.key}
                  onClick={() => setMarket(btn.key)}
                  style={{
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 500,
                    color: active ? '#60a5fa' : C.dim,
                    background: active ? 'rgba(96, 165, 250, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                    border: active ? '1px solid rgba(96, 165, 250, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 20,
                    padding: '4px 13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* 右側：資料更新時間與重新整理按鈕 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {scanDate && (
              <span style={{ fontSize: 11.5, color: C.dim, fontFamily: 'monospace' }}>
                更新: {scanDate}
              </span>
            )}
            <button
              onClick={onRefresh}
              disabled={refreshing}
              style={{
                fontSize: 12,
                color: C.dim,
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 6,
                padding: '4px 10px',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                opacity: refreshing ? 0.6 : 1,
              }}
            >
              {refreshing ? '更新中…' : '↺ 重新整理'}
            </button>
          </div>
        </div>

        {/* ── 大盤微型指示條 (Compact Market Regime Strip) ── */}
        {(twRegime || usRegime) && (
          <div
            style={{
              marginBottom: 14,
              padding: '8px 14px',
              borderRadius: 8,
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {twRegime && (market === 'all' || market === 'tw') && (
                <span style={{ color: C.mid }}>
                  🇹🇼 加權: <b style={{ color: twRegime.diff_ma50_pct >= 0 ? '#4ade80' : '#f87171' }}>
                    {twRegime.level || '偏多'} (季線 {twRegime.diff_ma50_pct >= 0 ? '+' : ''}{twRegime.diff_ma50_pct}%)
                  </b>
                </span>
              )}
              {usRegime && (market === 'all' || market === 'us') && (
                <span style={{ color: C.mid }}>
                  🇺🇸 標普: <b style={{ color: usRegime.diff_ma50_pct >= 0 ? '#4ade80' : '#f87171' }}>
                    {usRegime.level || '強勢'} (季線 {usRegime.diff_ma50_pct >= 0 ? '+' : ''}{usRegime.diff_ma50_pct}%)
                  </b>
                </span>
              )}
            </div>
            <div style={{ color: C.dim, fontSize: 11.5 }}>
              順勢交易 · 嚴守停損 · 切勿盲目追高
            </div>
          </div>
        )}

        {/* ── 卡片串流 (Action Card Stream) ── */}
        {isLoading && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 14px' }} />
            <div style={{ fontSize: 14, color: C.dim }}>正在分析市場精選清單…</div>
          </div>
        )}

        {!isLoading && displayedResults.length === 0 && (
          <div
            style={{
              padding: '50px 24px',
              textAlign: 'center',
              background: 'rgba(15, 23, 42, 0.4)',
              border: `1px solid ${C.border}`,
              borderRadius: 14,
            }}
          >
            <div style={{ fontSize: 26, marginBottom: 8 }}>🍵</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.hi, marginBottom: 6 }}>
              {strategy === 'short'
                ? '今日無符合短線起漲條件之標的'
                : strategy === 'trend'
                ? '目前無符合波段強勢門檻之標的'
                : '目前無符合存股條件之標的'}
            </div>
            <div style={{ fontSize: 13, color: C.dim, maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
              {strategy === 'short'
                ? '大盤震盪拉回時，市場買盤承接力道較弱。最佳策略為保留現金、耐心等待均線守穩訊號，亦可切換至「🌊 波段強勢」或「💰 ETF 存股」查看長期配置標的。'
                : '建議持續觀察大盤走勢，或點擊右上角「↺ 重新整理」更新最新選股資料。'}
            </div>
          </div>
        )}

        {!isLoading && displayedResults.length > 0 && (
          <div>
            {displayedResults.map(r => (
              <ActionCard
                key={r.code}
                r={r}
                strategy={strategy}
                onView={onView}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const root = document.getElementById('screener-root');
  if (root) ReactDOM.createRoot(root).render(<ScreenerPanel />);
})();
