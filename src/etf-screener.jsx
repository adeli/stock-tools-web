import React from 'react';
import ReactDOM from 'react-dom/client';
import { WORKER_URL } from './app.js';
import { getChangeColor, getWatchlist, addToWatchlist, removeFromWatchlist } from './utils.js';
import { WaterGauge } from './sema.jsx';
import {
  evaluateStockUnified,
  evaluateRrrGrade,
  CORE_US_ETFS_DEF,
  CORE_TW_ETFS_DEF,
} from './stock-evaluator.js';

// ── ETF 推薦與存股導航專區 (ETF Screener & DCA Hub) ─────────────────────────
// 專為定期定額、被動現金流、市值成長與資產配置投資人設計

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

  // 自選按鈕
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

    const toggle = e => {
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
          padding: '4px 9px',
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

  // ── ETF 專屬存股實戰卡片 (EtfCard) ──────────────────────────────────────────
  function EtfCard({ item, onViewGauge }) {
    const [gaugeOpen, setGaugeOpen] = useState(false);
    const [diagOpen, setDiagOpen] = useState(false);
    const [divOpen, setDivOpen] = useState(false);
    const [divHistory, setDivHistory] = useState(null);
    const [divLoading, setDivLoading] = useState(false);

    const isTw = item.isTw;
    const dispCode = (item.code || '').replace(/\.TW$/i, '');
    const price = item.price || 0;
    const chg = item.changePct ?? 0;
    const chgColor = getChangeColor(chg, item.code);

    const unified = useMemo(() => evaluateStockUnified(item), [item]);
    const badge = unified.badge;
    const rationale = unified.rationale;
    const semaData = item.sema_data || item;
    const div = item.dividend || {};

    const divHistoryCount = divHistory?.length || 0;
    const detectedFreq = divHistoryCount >= 40 ? '週配' : divHistoryCount >= 10 ? '月配' : divHistoryCount >= 3 ? '季配' : null;
    const freqStr = detectedFreq || div.freq || '季配';
    const monthsStr = div.months ? (freqStr === '週配' ? '每週發薪' : div.months.join('/') + '月') : (freqStr === '月配' ? '每月配息' : (freqStr === '週配' ? '每週發薪' : ''));
    const yieldVal = div.yield_pct;

    // 配息頻率顏色
    const freqColor = freqStr === '月配' ? '#38bdf8' : freqStr === '季配' ? '#4ade80' : freqStr === '週配' ? '#f43f5e' : '#fbbf24';
    const freqBg    = freqStr === '月配' ? 'rgba(56, 189, 248, 0.12)' : freqStr === '季配' ? 'rgba(74, 222, 128, 0.12)' : freqStr === '週配' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(251, 191, 36, 0.12)';
    const freqBorder= freqStr === '月配' ? 'rgba(56, 189, 248, 0.35)' : freqStr === '季配' ? 'rgba(74, 222, 128, 0.35)' : freqStr === '週配' ? 'rgba(244, 63, 94, 0.45)' : 'rgba(251, 191, 36, 0.35)';

    // 動態載入近一年歷史配息紀錄 (透過 Worker 代理 Yahoo Finance)
    const toggleDivHistory = async () => {
      if (divOpen) {
        setDivOpen(false);
        return;
      }
      setDivOpen(true);
      if (divHistory !== null) return;

      setDivLoading(true);
      try {
        const cacheKey = `etf_div_hist_${item.code}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setDivHistory(JSON.parse(cached));
          setDivLoading(false);
          return;
        }

        const symbol = item.isTw ? (item.code.includes('.') ? item.code : `${item.code}.TW`) : item.code;
        const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?events=div&range=1y&interval=1d`;
        const proxyUrl = `${WORKER_URL}/proxy?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyUrl);
        const json = await res.json();
        const rawDivs = json?.chart?.result?.[0]?.events?.dividends || {};
        const list = Object.entries(rawDivs).map(([ts, v]) => {
          const d = new Date(parseInt(ts, 10) * 1000);
          const dateStr = d.toISOString().slice(0, 10);
          return { date: dateStr, amount: Number(v.amount || 0) };
        }).sort((a, b) => b.date.localeCompare(a.date));

        setDivHistory(list);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(list));
        } catch (_) {}
      } catch (err) {
        console.warn('Fetch dividend history failed:', err);
        setDivHistory([]);
      } finally {
        setDivLoading(false);
      }
    };

    return (
      <div
        className="glass-hover"
        style={{
          background: C.cardBg,
          border: `1px solid ${gaugeOpen || diagOpen ? 'rgba(96, 165, 250, 0.45)' : C.border}`,
          borderRadius: 14,
          padding: '14px 18px',
          marginBottom: 10,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* LINE 1: 標題列 (代號、名稱、市場標籤、配息頻率、現價、漲跌幅、存股標籤) */}
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

            {/* 雙軌標籤：核心基石 vs 量化動態雷達 */}
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: item.tier === 'dynamic' ? '#fbbf24' : '#818cf8',
                background: item.tier === 'dynamic' ? 'rgba(251, 191, 36, 0.12)' : 'rgba(129, 140, 248, 0.12)',
                border: `1px solid ${item.tier === 'dynamic' ? 'rgba(251, 191, 36, 0.35)' : 'rgba(129, 140, 248, 0.3)'}`,
                borderRadius: 4,
                padding: '1px 5px',
              }}
            >
              {item.tier === 'dynamic' ? '⚡ 動態雷達' : '🏛️ 核心基石'}
            </span>

            {/* 配息週期標籤 (月配 / 季配 / 週配) */}
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: freqColor,
                background: freqBg,
                border: `1px solid ${freqBorder}`,
                borderRadius: 4,
                padding: '1px 6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <span>📅</span>
              <span>{freqStr}{monthsStr ? ` (${monthsStr})` : ''}</span>
            </span>

            {/* 名稱 */}
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: C.dim,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 180,
              }}
            >
              {item.name}
            </span>
          </div>

          {/* 右側：現價 + 漲跌幅 + 存股實戰狀態徽章 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16.5, fontWeight: 800, fontFamily: 'monospace', color: C.hi, lineHeight: 1.1 }}>
                ${price}
              </div>
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: chgColor, marginTop: 2 }}>
                {chg > 0 ? '+' : ''}{chg != null ? chg.toFixed(2) : '0.00'}%
              </div>
            </div>

            {/* 存股實戰狀態徽章 */}
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: badge.color,
                background: badge.bg,
                border: `1px solid ${badge.border}`,
                borderRadius: 20,
                padding: '3px 11px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              {badge.text}
            </div>
          </div>
        </div>

        {/* LINE 2: 核心存股指引一句話 (Rationale) */}
        <div
          style={{
            marginTop: 8,
            marginBottom: 10,
            fontSize: 12.5,
            color: '#e2e8f0',
            lineHeight: 1.45,
            opacity: 0.94,
            letterSpacing: '0.01em',
          }}
        >
          {rationale}
        </div>

        {/* LINE 3: 存股關鍵數據條 + 快捷操作按鈕 */}
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
          {/* 左側：存股數據 Pills */}
          <div className="trade-pills-row" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            {/* 年化殖利率高亮 */}
            {yieldVal != null && (
              <div
                style={{
                  fontSize: 11.5,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: yieldVal >= 7.0 ? '#4ade80' : yieldVal >= 4.0 ? '#facc15' : '#93c5fd',
                  background: yieldVal >= 7.0 ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${yieldVal >= 7.0 ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: 5,
                  padding: '2px 8px',
                }}
              >
                <span style={{ color: C.dim, fontSize: 10.5 }}>年化殖利: </span>
                {yieldVal.toFixed(1)}%
              </div>
            )}

            {/* 每股配息 / 近期配息 */}
            {div.last_amt != null && (
              <div
                style={{
                  fontSize: 11.5,
                  fontFamily: 'monospace',
                  color: '#e2e8f0',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 5,
                  padding: '2px 7px',
                }}
              >
                <span style={{ color: C.dim, fontSize: 10.5 }}>每股配: </span>${div.last_amt}
              </div>
            )}

            {/* 填息能力 */}
            {div.fill_rate && (
              <div
                style={{
                  fontSize: 11.5,
                  color: '#86efac',
                  background: 'rgba(74, 222, 128, 0.08)',
                  border: '1px solid rgba(74, 222, 128, 0.22)',
                  borderRadius: 5,
                  padding: '2px 7px',
                }}
              >
                {div.fill_rate}
              </div>
            )}

            {/* 距年線 (200MA) 長線多空位階 */}
            {unified.ma200Dist != null && (
              <div
                style={{
                  fontSize: 11.5,
                  fontFamily: 'monospace',
                  color: unified.ma200Dist >= 0 ? '#38bdf8' : '#f87171',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 5,
                  padding: '2px 7px',
                }}
              >
                <span style={{ color: C.dim, fontSize: 10.5 }}>距年線: </span>
                {unified.ma200Dist > 0 ? '+' : ''}{unified.ma200Dist}%
              </div>
            )}

            {/* SEMA 均線支撐關卡 */}
            {unified.pLine && (
              <div
                style={{
                  fontSize: 11.5,
                  fontFamily: 'monospace',
                  color: '#facc15',
                  background: 'rgba(250, 204, 21, 0.06)',
                  border: '1px solid rgba(250, 204, 21, 0.2)',
                  borderRadius: 5,
                  padding: '2px 7px',
                }}
              >
                支撐: {unified.pLine} (+{unified.distS}%)
              </div>
            )}
          </div>

          {/* 右側：動作按鈕 */}
          <div className="card-action-bar" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <WatchlistButton code={item.code} name={item.name} />

            <button
              onClick={toggleDivHistory}
              title="查看近一年歷史配息記錄與發薪日"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: divOpen ? '#ffffff' : '#34d399',
                background: divOpen ? 'rgba(52, 211, 153, 0.3)' : 'rgba(52, 211, 153, 0.08)',
                border: `1px solid ${divOpen ? 'rgba(52, 211, 153, 0.5)' : 'rgba(52, 211, 153, 0.3)'}`,
                borderRadius: 6,
                padding: '4px 9px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              💵 近年配息 {divOpen ? '▲' : '▾'}
            </button>

            <button
              onClick={() => setGaugeOpen(!gaugeOpen)}
              title="查看 SEMA 通道垂直水位計"
              style={{
                fontSize: 12,
                color: gaugeOpen ? '#ffffff' : '#60a5fa',
                background: gaugeOpen ? 'rgba(96, 165, 250, 0.3)' : 'rgba(96, 165, 250, 0.08)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                borderRadius: 6,
                padding: '4px 9px',
                cursor: 'pointer',
              }}
            >
              📈 水位計 {gaugeOpen ? '▲' : '▾'}
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

            <button
              onClick={() => setDiagOpen(!diagOpen)}
              style={{
                fontSize: 11,
                color: diagOpen ? '#93c5fd' : C.dim,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 6px',
              }}
            >
              {diagOpen ? '收合 ▲' : '診斷 ▾'}
            </button>
          </div>
        </div>

        {/* 展開抽屜：近一年配息記錄 (比照 ETF 股利頁面設計) */}
        {divOpen && (
          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
            }}
          >
            {divLoading ? (
              <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12.5, color: C.dim }}>
                ⏳ 正在連線讀取近一年除息記錄…
              </div>
            ) : divHistory && divHistory.length > 0 ? (
              <div>
                {/* 頂部統計指標條 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>
                      💵 近 12 個月除息記錄
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#34d399',
                        background: 'rgba(52, 211, 153, 0.12)',
                        padding: '1px 6px',
                        borderRadius: 4,
                      }}
                    >
                      共 {divHistory.length} 次除息發薪
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: C.mid }}>
                    近一年累計配息：
                    <b style={{ color: '#facc15', fontFamily: 'monospace', fontSize: 13.5 }}>
                      {item.isTw ? 'NT$' : '$'}{divHistory.reduce((s, d) => s + d.amount, 0).toFixed(4)}
                    </b>
                    {price > 0 && (
                      <span style={{ marginLeft: 6, color: '#4ade80', fontWeight: 700 }}>
                        (近1年實質殖利率 {((divHistory.reduce((s, d) => s + d.amount, 0) / price) * 100).toFixed(2)}%)
                      </span>
                    )}
                  </div>
                </div>

                {/* 配息格子清單 (比照 ETF 股利頁面的卡片排列) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))',
                    gap: 6,
                    maxHeight: 200,
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}
                >
                  {divHistory.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        background: 'rgba(15, 23, 42, 0.55)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 8,
                        padding: '6px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                        {d.date}
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, fontFamily: 'monospace', color: '#f1f5f9' }}>
                        {item.isTw ? 'NT$' : '$'}{d.amount.toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '14px 0', textAlign: 'center', fontSize: 12.5, color: C.dim }}>
                {div.yield_pct != null
                  ? `該標的預估年化殖利率約 ${div.yield_pct}%，近一年除息記錄未抓取或為累積型/新發行基金`
                  : '該標的暫無近一年歷史除息數據'}
              </div>
            )}
          </div>
        )}

        {/* 展開抽屜：SEMA 通道垂直水位計 */}
        {gaugeOpen && (
          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(96, 165, 250, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#93c5fd' }}>
                🌊 {dispCode} SEMA 通道垂直水位計
              </span>
              <span style={{ fontSize: 11, color: C.dim }}>
                浮球=現價 · 上方紅區為阻力 · 下方綠區為特價加碼支撐
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <WaterGauge data={semaData} gaugeW={720} />
            </div>
          </div>
        )}

        {/* 展開抽屜：五維度決策診斷 */}
        {diagOpen && (
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
            {unified.eval?.dimensions && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 6 }}>
                {Object.entries(unified.eval.dimensions).map(([k, d]) => (
                  <div
                    key={k}
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: `1px solid ${d.light === 'GREEN' ? '#4ade8033' : d.light === 'YELLOW' ? '#facc1533' : '#f8717133'}`,
                      borderRadius: 6,
                      padding: '5px 8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>{d.name}</span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, color: d.light === 'GREEN' ? '#4ade80' : d.light === 'YELLOW' ? '#facc15' : '#f87171' }}>
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
          </div>
        )}
      </div>
    );
  }

  // ── 主面板 (EtfScreenerPanel) ───────────────────────────────────────────────
  function EtfScreenerPanel() {
    // 類別過濾: 'all' | 'dividend' (高息現金流) | 'growth' (市值成長型) | 'bond' (債券防禦型) | 'combo' (月月配組合)
    const [category, setCategory] = useState('all');
    // 市場過濾: 'all' | 'tw' | 'us'
    const [market, setMarket] = useState('all');

    const [liveData, setLiveData] = useState({});
    const [loading, setLoading] = useState(false);

    // 彙整台美股全部核心 ETF 定義清單 (排除純槓桿正2正3)
    const rawEtfPool = useMemo(() => {
      const twList = CORE_TW_ETFS_DEF
        .filter(x => !x.isLeverage && x.category !== 'leverage')
        .map(x => ({ ...x, isTw: true, symbol: `${x.code}.TW` }));
      const usList = CORE_US_ETFS_DEF
        .filter(x => !x.isLeverage && x.category !== 'leverage')
        .map(x => ({ ...x, isTw: false, symbol: x.code }));
      return [...twList, ...usList];
    }, []);

    // 批次載入 SEMA 即時最新行情
    const loadBatchQuotes = useCallback(async () => {
      setLoading(true);
      try {
        const symbols = rawEtfPool.map(x => x.symbol);
        if (window.fetchSemaBatch) {
          const map = await window.fetchSemaBatch(symbols);
          setLiveData(map);
          try {
            sessionStorage.setItem('etf_screener_quotes', JSON.stringify(map));
          } catch (_) {}
        }
      } catch (err) {
        console.warn('Load ETF SEMA batch failed:', err);
      } finally {
        setLoading(false);
      }
    }, [rawEtfPool]);

    useEffect(() => {
      try {
        const cached = JSON.parse(sessionStorage.getItem('etf_screener_quotes') || '{}');
        if (Object.keys(cached).length > 0) setLiveData(cached);
      } catch (_) {}
      loadBatchQuotes();
      window.etfScreenerLoad = () => loadBatchQuotes();
      return () => { window.etfScreenerLoad = null; };
    }, [loadBatchQuotes]);

    // 合併靜態定義與 SEMA 行情
    const fullEtfs = useMemo(() => {
      return rawEtfPool.map(def => {
        const sema = liveData[def.symbol] || liveData[def.code] || {};
        const price = sema.price || 0;
        const changePct = sema.changePct ?? 0;
        return {
          ...def,
          price,
          changePct,
          sema_data: sema,
        };
      });
    }, [rawEtfPool, liveData]);

    // 月月配/週週配組合標的清單
    const COMBO_CODES = useMemo(() => new Set(['0056', '00878', '00919', 'SCHD', 'JEPI', 'JEPQ', 'XDTE', 'QDTE', 'SGOV']), []);

    // 依類別與市場過濾
    const filteredEtfs = useMemo(() => {
      let list = fullEtfs;

      if (market === 'tw') list = list.filter(x => x.isTw);
      if (market === 'us') list = list.filter(x => !x.isTw);

      if (category === 'combo') {
        list = list.filter(x => COMBO_CODES.has(x.code));
      } else if (category !== 'all') {
        list = list.filter(x => x.category === category);
      }

      // 智能排序：
      // 1. 便宜特價加碼點優先
      // 2. 高股息依殖利率由大到小；市值型依拉回特價度/RS評級
      return list.sort((a, b) => {
        const aCheap = a.sema_data?.setup?.dist_support_pct != null && a.sema_data.setup.dist_support_pct <= 2.2 ? 1 : 0;
        const bCheap = b.sema_data?.setup?.dist_support_pct != null && b.sema_data.setup.dist_support_pct <= 2.2 ? 1 : 0;
        if (bCheap !== aCheap) return bCheap - aCheap;

        if (category === 'growth') {
          return (b.rs_rating || 0) - (a.rs_rating || 0);
        }
        const yA = a.dividend?.yield_pct || 0;
        const yB = b.dividend?.yield_pct || 0;
        if (Math.abs(yB - yA) > 0.001) return yB - yA;
        return (a.code || '').localeCompare(b.code || '');
      });
    }, [fullEtfs, market, category, COMBO_CODES]);

    // 依當前市場計算類別計數（讓類別按鈕數量隨市場切換動態連動）
    const marketFilteredPool = useMemo(() => {
      if (market === 'tw') return fullEtfs.filter(x => x.isTw);
      if (market === 'us') return fullEtfs.filter(x => !x.isTw);
      return fullEtfs;
    }, [fullEtfs, market]);

    const countAll      = marketFilteredPool.length;
    const countDividend = marketFilteredPool.filter(x => x.category === 'dividend').length;
    const countGrowth   = marketFilteredPool.filter(x => x.category === 'growth').length;
    const countBond     = marketFilteredPool.filter(x => x.category === 'bond').length;
    const countCombo    = marketFilteredPool.filter(x => COMBO_CODES.has(x.code)).length;

    // 依當前類別計算市場計數（讓市場按鈕數量隨類別切換動態連動）
    const categoryFilteredPool = useMemo(() => {
      if (category === 'combo') {
        return fullEtfs.filter(x => COMBO_CODES.has(x.code));
      }
      if (category !== 'all') {
        return fullEtfs.filter(x => x.category === category);
      }
      return fullEtfs;
    }, [fullEtfs, category, COMBO_CODES]);

    const countMktAll = categoryFilteredPool.length;
    const countMktTw  = categoryFilteredPool.filter(x => x.isTw).length;
    const countMktUs  = categoryFilteredPool.filter(x => !x.isTw).length;

    // 存股類別按鈕 (動態反映當前市場下的各類別數量)
    const CATEGORY_BUTTONS = [
      { key: 'all',      icon: '🌐', title: '全部 ETF', count: countAll, desc: '全市場核心與動態資產' },
      { key: 'dividend', icon: '💰', title: '高息現金流', count: countDividend, desc: '7~26%+ 週/月/季高配息' },
      { key: 'growth',   icon: '🚀', title: '市值成長型', count: countGrowth, desc: '長線大盤複利翻倍' },
      { key: 'bond',     icon: '🛡️', title: '債券防禦型', count: countBond, desc: '短長債避險 · 鎖定息率' },
      { key: 'combo',    icon: '✨', title: '月月領息指南', count: countCombo, desc: '自組週月現金流' },
    ];

    // 市場篩選按鈕 (動態反映當前類別下的各市場數量)
    const MARKET_BUTTONS = [
      { key: 'all', label: `全部 (${countMktAll})` },
      { key: 'tw',  label: `🇹🇼 台股 (${countMktTw})` },
      { key: 'us',  label: `🇺🇸 美股 (${countMktUs})` },
    ];

    return (
      <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 40 }}>
        {/* 頁頭標題 */}
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>💰</span>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: C.hi, margin: 0, letterSpacing: '-0.02em' }}>
                ETF 推薦與存股導航
              </h2>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: C.dim }}>
              專為定期定額、被動現金流、市值成長與資產配置投資人打造的實戰選股中心
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => loadBatchQuotes()}
              disabled={loading}
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: '#93c5fd',
                background: 'rgba(96, 165, 250, 0.1)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                borderRadius: 8,
                padding: '6px 12px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>{loading ? '更新中…' : '↺ 更新即時報價'}</span>
            </button>
          </div>
        </div>

        {/* 存股類別大卡片切換 (Category Tabs) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
            gap: 8,
            marginBottom: 14,
          }}
        >
          {CATEGORY_BUTTONS.map(btn => {
            const isActive = category === btn.key;
            return (
              <button
                key={btn.key}
                onClick={() => setCategory(btn.key)}
                style={{
                  background: isActive ? 'rgba(56, 189, 248, 0.15)' : C.cardBg,
                  border: `1.5px solid ${isActive ? '#38bdf8' : C.border}`,
                  borderRadius: 12,
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  boxShadow: isActive ? '0 0 14px rgba(56, 189, 248, 0.2)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>{btn.icon}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: isActive ? '#ffffff' : C.hi }}>
                      {btn.title}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: isActive ? '#38bdf8' : C.dim,
                      background: isActive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      padding: '1px 6px',
                      borderRadius: 10,
                    }}
                  >
                    {btn.count}
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: isActive ? '#93c5fd' : C.dim, opacity: 0.85 }}>
                  {btn.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* 月月領息指南特別區塊 */}
        {category === 'combo' && (
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(96, 165, 250, 0.35)',
              borderRadius: 14,
              padding: '18px 20px',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>✨</span>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
                經典自組「月月領息」被動現金流指南
              </h3>
            </div>
            <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.6, marginBottom: 14 }}>
              許多存股投資人喜歡每月都有固定被動現金流入帳。透過挑選不同月份除息的優質「季配」或「月配」ETF，即可達成 1~12 月完全無死角的現金流發薪日！下方已為您即時連線列出該組合所有核心標的之位階與股息率。
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 12 }}>
              {/* 組合一：台股經典 */}
              {(market === 'all' || market === 'tw') && (
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(74, 222, 128, 0.25)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: '#4ade80' }}>
                      🏆 台股經典「黃金三角」組合
                    </span>
                    <span style={{ fontSize: 11, color: '#86efac', background: 'rgba(74, 222, 128, 0.1)', padding: '1px 6px', borderRadius: 4 }}>
                      預估年化 ~8.7%
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.mid, lineHeight: 1.5 }}>
                    • <b>1, 4, 7, 10月</b>：0056 元大高股息 (8.7%)<br />
                    • <b>2, 5, 8, 11月</b>：00878 國泰永續高股息 (7.1%)<br />
                    • <b>3, 6, 9, 12月</b>：00919 群益精選高息 (10.4%)
                  </div>
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>
                    優勢：百萬股民最信賴組合，平攤單一投信選股風險，歷年填息紀錄穩健。
                  </div>
                </div>
              )}

              {/* 組合二：美股息利雙收 */}
              {(market === 'all' || market === 'us') && (
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: '#38bdf8' }}>
                      🇺🇸 美股「息利雙收」核心組合
                    </span>
                    <span style={{ fontSize: 11, color: '#7dd3fc', background: 'rgba(56, 189, 248, 0.1)', padding: '1px 6px', borderRadius: 4 }}>
                      預估年化 ~7.2%
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.mid, lineHeight: 1.5 }}>
                    • <b>核心成長基石</b>：SCHD (季配 3/6/9/12月)<br />
                    • <b>月配高額現金</b>：JEPI (標普500掩護買權 · 月配)<br />
                    • <b>科技高息動能</b>：JEPQ (納指100掩護買權 · 月配)
                  </div>
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>
                    優勢：兼顧美元資產配置，既有 SCHD 股息成長體質，又有 JEPI/JEPQ 高額月配補貼。
                  </div>
                </div>
              )}

              {/* 組合三：美股極致週配發薪日 */}
              {(market === 'all' || market === 'us') && (
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: '#f43f5e' }}>
                      ⚡ 美股極致「週配發薪」組合
                    </span>
                    <span style={{ fontSize: 11, color: '#fda4af', background: 'rgba(244, 63, 94, 0.12)', padding: '1px 6px', borderRadius: 4 }}>
                      預估年化 ~20%+
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.mid, lineHeight: 1.5 }}>
                    • <b>每週五發薪①</b>：XDTE 標普500 0DTE (週配 ~18%)<br />
                    • <b>每週五發薪②</b>：QDTE 納指100 0DTE (週配 ~26%)<br />
                    • <b>資金停泊底座</b>：SGOV 0-3月超短債 (月配 ~5.1%)
                  </div>
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>
                    優勢：每週五固定現金入帳，搭配 SGOV 超短債停泊本金避險，兼顧極高現金流與下檔防守。
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 市場切換膠囊 (全部 / 台股 / 美股) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: C.dim, marginRight: 4 }}>市場篩選:</span>
          {MARKET_BUTTONS.map(btn => (
            <button
              key={btn.key}
              onClick={() => setMarket(btn.key)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: market === btn.key ? '#ffffff' : C.dim,
                background: market === btn.key ? 'rgba(96, 165, 250, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${market === btn.key ? 'rgba(96, 165, 250, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
                borderRadius: 6,
                padding: '4px 10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* 結果數量與狀態提示列 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: '10px 0 12px',
            padding: '6px 4px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.dim }}>
            <span>符合條件：</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.12)',
                padding: '2px 8px',
                borderRadius: 12,
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontFamily: 'monospace',
              }}
            >
              {filteredEtfs.length} 檔 ETF
            </span>
            <span style={{ fontSize: 11.5, color: C.mid }}>
              ({market === 'all' ? '全部市場' : market === 'tw' ? '🇹🇼 台股' : '🇺🇸 美股'} · {
                category === 'all' ? '全部核心' :
                category === 'dividend' ? '高息現金流' :
                category === 'growth' ? '市值成長型' :
                category === 'bond' ? '債券防禦型' : '月月領息指南'
              })
            </span>
          </div>

          <div style={{ fontSize: 11, color: C.dim }}>
            {category === 'growth' ? '⚡ 依 RS 相對強度排序' : '💰 優先顯示便宜加碼位階 · 依殖利率排序'}
          </div>
        </div>

        {/* ETF 清單 */}
        <div>
          {filteredEtfs.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: C.cardBg,
                borderRadius: 14,
                border: `1px dashed ${C.border}`,
                color: C.dim,
                fontSize: 14,
              }}
            >
              此條件下暫無符合之 ETF 標的
            </div>
          ) : (
            filteredEtfs.map(item => (
              <EtfCard key={item.code} item={item} />
            ))
          )}
        </div>
      </div>
    );
  }

  // 掛載到 DOM
  const rootEl = document.getElementById('etf-screener-root');
  if (rootEl) {
    const root = ReactDOM.createRoot(rootEl);
    root.render(<EtfScreenerPanel />);
  }
})();
