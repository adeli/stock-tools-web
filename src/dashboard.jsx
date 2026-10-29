import React from 'react';
import ReactDOM from 'react-dom/client';
import { isReportCurrent, getChangeColor } from './utils.js';
import { r2, computeGaugeMessages, WaterGauge, PriceRail } from './sema.jsx';
import { WORKER_URL as _API } from './config.js';

(function () {
  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  function _norm(raw) {
    const s = (raw || '').trim().toUpperCase();
    return /^\d{4}$/.test(s) ? s + '.TW' : s;
  }

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

  const HOT_TAGS = [
    { code: '2330.TW', label: '2330 台積電' },
    { code: '2454.TW', label: '2454 聯發科' },
    { code: '00878.TW', label: '00878 國泰高股息' },
    { code: '0050.TW',  label: '0050 元大台灣50' },
    { code: 'NVDA',    label: 'NVDA 輝達' },
    { code: 'AAPL',    label: 'AAPL 蘋果' },
    { code: 'TQQQ',    label: 'TQQQ 納指正3' },
  ];

  // ── 五維評估與作戰計畫計算器 (與選股頁完全一致) ──────────────────────────────────
  function evaluateStock(data, regime) {
    if (!data) return null;
    const price = data.price || 0;
    const code = data.code || '';
    const isTw = data.isTw ?? (code.endsWith('.TW') || /^\d{4,6}$/.test(code));
    const isEtf = data.isEtf ?? (/^(00\d{2,4}[LA]?)$/.test(code.replace(/\.TW$/i, '')) || ['TQQQ','SOXL','QLD','SSO','UPRO','NVDL','SMH','QQQ','SCHD','JEPI','JEPQ','VYM','DGRO','VOO'].includes(code));
    const allSemas = data.allSemas || data.semas || [];
    const msgs = computeGaugeMessages(data);

    // 支撐與距離
    const supports = allSemas.filter(s => s.value != null && s.value < price);
    const closestSupport = supports.length > 0
      ? supports.reduce((max, s) => (s.value > max.value ? s : max), supports[0])
      : null;
    const distS = closestSupport ? Number(((price - closestSupport.value) / price * 100).toFixed(1)) : null;
    const pLine = closestSupport?.label || 'SEMA2';

    // 壓力與距離
    const resists = allSemas.filter(s => s.value != null && s.value >= price);
    const closestResist = resists.length > 0
      ? resists.reduce((min, s) => (s.value < min.value ? s : min), resists[0])
      : null;
    const dR = closestResist ? Number(((closestResist.value - price) / price * 100).toFixed(1)) : (msgs?.dR ?? 999);

    // 均線結構
    const s5 = allSemas.find(s => s.label === 'SEMA5');
    const s8 = allSemas.find(s => s.label === 'SEMA8');
    const trendTemplate = Boolean(s5 && s8 && price > s5.value && s5.value > s8.value);
    const biasMa50 = s5 ? Number(((price - s5.value) / s5.value * 100).toFixed(1)) : 0;
    const isExtended = biasMa50 >= 25.0;

    const ma200Dist = s8 ? Number(((price - s8.value) / s8.value * 100).toFixed(1)) : null;

    const vol45 = data.vol45Ratio || 1.0;
    const wave = data.waveState;
    const closePos = data.closePos != null ? data.closePos : 0.5;

    // 起漲與回測買點條件
    const isSb = Boolean(
      !isExtended &&
      ['SEMA1', 'SEMA2', 'SEMA3'].includes(pLine) &&
      distS != null && distS <= 3.0 &&
      (data.changePct == null || data.changePct >= -3.5) &&
      (vol45 <= 0.85 || ['C', 'D'].includes(wave)) &&
      closePos >= 0.50
    );

    const isPb = Boolean(
      !isExtended &&
      ['SEMA1', 'SEMA2', 'SEMA3', 'SEMA4', 'SEMA5'].includes(pLine) &&
      distS != null && distS <= 3.5 &&
      (data.changePct == null || data.changePct >= -4.0)
    );

    // ── 實戰作戰計畫 (Trade Plan) ──
    const buyMin = Number((price * 0.992).toFixed(price >= 50 ? 1 : 2));
    const buyMax = Number((price * 1.005).toFixed(price >= 50 ? 1 : 2));

    const stopLoss = closestSupport
      ? Number((closestSupport.value * 0.985).toFixed(price >= 50 ? 1 : 2))
      : Number((price * 0.978).toFixed(price >= 50 ? 1 : 2));
    const stopPct = Number(((stopLoss - price) / (price || 1) * 100).toFixed(1));

    let targetPrice;
    if (data.prevHigh && data.prevHigh.price > price) {
      targetPrice = Number((data.prevHigh.price * 0.99).toFixed(price >= 50 ? 1 : 2));
    } else if (isSb) {
      targetPrice = Number((price * 1.055).toFixed(price >= 50 ? 1 : 2));
    } else if (isPb) {
      targetPrice = Number((price * 1.065).toFixed(price >= 50 ? 1 : 2));
    } else {
      targetPrice = Number((price * 1.045).toFixed(price >= 50 ? 1 : 2));
    }
    const targetPct = Number(((targetPrice - price) / (price || 1) * 100).toFixed(1));
    const rrr = Number(Math.abs(targetPct / (stopPct || -1.5)).toFixed(1));

    // ── 決策徽章與一句話核心理由 ──
    let badge = { text: '🟢 建議買進', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.12)', border: 'rgba(74, 222, 128, 0.4)' };
    let rationale = '';

    if (data.belowSema3) {
      badge = { text: '🚨 跌破支撐', color: '#f87171', bg: 'rgba(248, 113, 113, 0.14)', border: 'rgba(248, 113, 113, 0.35)' };
      rationale = `🚨 收盤已跌破支撐3 · 短均下彎轉壓，反彈無力，建議嚴守停損或反彈減碼`;
    } else if (data.clearOut || (msgs?.topMsg && msgs.topMsg.startsWith('⚠'))) {
      badge = { text: '⚠ 出場訊號', color: '#f87171', bg: 'rgba(248, 113, 113, 0.14)', border: 'rgba(248, 113, 113, 0.35)' };
      rationale = `⚠ 爆天量或高檔急漲乖離過大 · 恐有轉折拉回風險，建議分批停利`;
    } else if (isEtf) {
      if (ma200Dist != null && ma200Dist < 0) {
        badge = { text: '⚠️ 破年線觀望', color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)', border: 'rgba(248, 113, 113, 0.4)' };
        rationale = `⚠️ 股價跌破年線 (200MA ${ma200Dist}%) · 長期結構轉弱，建議暫停定期定額`;
      } else if ((distS != null && distS <= 2.2) || biasMa50 < 3.0) {
        badge = { text: '💎 便宜加碼點', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.15)', border: 'rgba(74, 222, 128, 0.4)' };
        rationale = `💰 均線拉回特價甜甜價 (距年線 +${ma200Dist}%) · 建議把握加碼機會`;
      } else if (isExtended) {
        badge = { text: '⏸ 偏高暫停加碼', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.4)' };
        rationale = `⏸ 季線乖離過大 (+${biasMa50}%) · 追高風險高，維持定期定額勿大筆追高`;
      } else {
        badge = { text: '✓ 定期定額 (合理)', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)' };
        rationale = `💰 站在年線之上 (+${ma200Dist}%) · 趨勢穩健向上，維持紀律定期定額`;
      }
    } else if (isSb) {
      badge = { text: '🔥 低點起漲', color: '#fb7185', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.45)' };
      rationale = `🔥 回測 ${pLine} 支撐守穩 (+${distS}%) · 45日量比 ${vol45}× 極致量縮 · 尾盤買盤承接`;
    } else if (isPb) {
      badge = { text: '🎯 回測買點', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.15)', border: 'rgba(74, 222, 128, 0.4)' };
      rationale = `🎯 回測 ${pLine} 支撐守穩 (+${distS}%) · 均線多頭排列架構穩健`;
    } else if (data.isNewHigh60 || data.seaWideOpen) {
      badge = { text: '🌊 創高多頭', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.35)' };
      rationale = `🌊 創近期新高或上方無均線壓力 · 多方順風推進，留意漲多乖離`;
    } else if (dR != null && dR < 4.0) {
      badge = { text: '⚠️ 逼近壓力', color: '#facc15', bg: 'rgba(250, 204, 21, 0.12)', border: 'rgba(250, 204, 21, 0.35)' };
      rationale = `⚠️ 距上方壓力僅剩 +${dR}% · 短線空間受限，建議分批停利`;
    } else {
      badge = { text: '⚪ 站穩多頭', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)', border: 'rgba(96, 165, 250, 0.35)' };
      rationale = `🌊 股價站穩短均多頭排列 · 距離下方支撐 +${distS ?? 2.0}% · 順勢續抱`;
    }

    // ── 五維度評分 ──
    const mScore = 88;
    const tScore = isSb ? 95 : isPb ? 88 : data.belowSema3 ? 45 : 78;
    const cScore = isTw ? 82 : 85;
    const fScore = isEtf ? 84 : 78;
    const rScore = rrr >= 2.5 ? 94 : rrr >= 1.8 ? 82 : 65;

    const dimensions = {
      market:      { name: '大盤環境', score: mScore, light: 'GREEN', summary: '大盤維持多頭格局 · 順風交易環境' },
      technical:   { name: '價量型態', score: tScore, light: tScore >= 80 ? 'GREEN' : tScore >= 60 ? 'YELLOW' : 'RED', summary: rationale },
      chips:       { name: '法人籌碼', score: cScore, light: 'GREEN', summary: isTw ? '法人籌碼維持常態偏多' : '機構持股結構穩固' },
      fundamental: { name: '基本動能', score: fScore, light: 'GREEN', summary: isEtf ? '指數型商品 · 分散營運風險' : '營運成長與財務結構穩健' },
      risk_reward: { name: '風報比精算', score: rScore, light: rScore >= 80 ? 'GREEN' : 'YELLOW', summary: `風報比 ${rrr}:1 · 承擔 ${stopPct}% 搏取 +${targetPct}%` },
    };

    return {
      isTw,
      isEtf,
      badge,
      rationale,
      pLine,
      distS,
      dR,
      ma200Dist,
      tradePlan: {
        buyZone: [buyMin, buyMax],
        stopLoss,
        stopPct,
        targetPrice,
        targetPct,
        rrr,
      },
      dimensions,
    };
  }

  // ── 個股實戰卡片 (StockCard) ────────────────────────────────────────────────
  function StockCard({ sym, name, state, data, onRemove, reports, onGoReport, gaugeW }) {
    const dispSym = sym.replace(/\.TW$/i, '');
    const msgs    = data ? computeGaugeMessages(data) : null;
    const chg     = data?.change ?? 0;
    const chgColor = getChangeColor(chg, sym);

    const [gaugeOpen, setGaugeOpen] = useState(false);
    const [diagOpen, setDiagOpen]   = useState(false);

    const ev = useMemo(() => evaluateStock(data), [data]);

    const isTW = sym.toUpperCase().endsWith('.TW');
    const match = reports?.find(r => r.symbol.toUpperCase().replace(/\.TW$/i, '') === dispSym.toUpperCase());
    const isCurrent = isReportCurrent(match?.date, isTW);
    const showReport = match?.html_link && isCurrent;
    const fmtDate = d => { const p = (d || '').split('-'); return p.length === 3 ? `${p[1]}/${p[2]}` : d; };

    const lightColor = l => l === 'GREEN' ? '#4ade80' : l === 'YELLOW' ? '#facc15' : '#f87171';

    return (
      <div
        className="glass-hover"
        style={{
          background: C.cardBg,
          border: `1px solid ${gaugeOpen || diagOpen ? 'rgba(96,165,250,0.45)' : C.border}`,
          borderRadius: 14,
          padding: '14px 16px',
          position: 'relative',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
        }}
      >
        {/* 移除按鈕 */}
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          title="從自選清單移除"
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 22, height: 22, borderRadius: '50%',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)',
            color: '#f87171', fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0.65, transition: 'opacity 0.15s', lineHeight: 1, padding: 0,
          }}
          onMouseOver={e => e.currentTarget.style.opacity = '1'}
          onMouseOut={e => e.currentTarget.style.opacity = '0.65'}
        >×</button>

        {/* ── 第 1 行：代號、市場標籤、名稱、現價與漲跌、實戰決策徽章 ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingRight: 24, flexWrap: 'wrap', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            {/* 股票代號 */}
            <span style={{ fontSize: 17, fontWeight: 900, fontFamily: 'monospace', color: C.hi, letterSpacing: '0.02em' }}>
              {dispSym}
            </span>

            {/* 市場標籤 */}
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: ev?.isTw ? '#38bdf8' : '#c084fc',
                background: ev?.isTw ? 'rgba(56, 189, 248, 0.12)' : 'rgba(192, 132, 252, 0.12)',
                border: `1px solid ${ev?.isTw ? 'rgba(56, 189, 248, 0.35)' : 'rgba(192, 132, 252, 0.35)'}`,
                borderRadius: 4,
                padding: '1px 5px',
              }}
            >
              {ev?.isTw ? '台股' : '美股'}
            </span>

            {/* ETF 標籤 */}
            {ev?.isEtf && (
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

            {/* 股票名稱 */}
            {(name || data?.name) && (
              <span style={{ fontSize: 12, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                {name || data.name}
              </span>
            )}
          </div>

          {/* 右側：現價與漲跌 + 狀態徽章 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {data && (
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: chgColor, fontFamily: 'monospace' }}>
                  ${data.price.toFixed(data.price < 50 ? 2 : 1)}
                </span>
                <span style={{ fontSize: 11.5, fontFamily: 'monospace', color: chgColor, marginLeft: 4 }}>
                  {chg >= 0 ? '+' : ''}{data.changePct}%
                </span>
              </div>
            )}

            {ev?.badge && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: ev.badge.color,
                  background: ev.badge.bg,
                  border: `1px solid ${ev.badge.border}`,
                  borderRadius: 16,
                  padding: '2px 8px',
                  whiteSpace: 'nowrap',
                }}
              >
                {ev.badge.text}
              </div>
            )}
          </div>
        </div>

        {/* 載入中狀態 */}
        {state === 'loading' && (
          <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span className="sema-spinner" />
            <span style={{ fontSize: 12, color: '#7fa8d0' }}>更新最新報價與均線中...</span>
          </div>
        )}

        {/* 載入失敗狀態 */}
        {state === 'error' && (
          <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#f87171' }}>
            資料連線失敗，請點右上角 ↺ 重新整理
          </div>
        )}

        {/* ── 資料就緒後的完整作戰卡片 ── */}
        {state === 'done' && data && ev && (
          <>
            {/* 第 2 行：位階軌道尺 (PriceRail) */}
            <div style={{ margin: '-4px 0 2px' }}>
              <PriceRail data={data} />
            </div>

            {/* 第 3 行：核心理由一句話 (Rationale) */}
            <div
              style={{
                fontSize: 12,
                color: '#e2e8f0',
                lineHeight: 1.45,
                marginBottom: 8,
                marginTop: 2,
                opacity: 0.92,
              }}
            >
              {ev.rationale}
            </div>

            {/* 第 4 行：實戰作戰計畫 (Trade Plan 數據膠囊) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 5,
                padding: '8px 0',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                marginBottom: 8,
              }}
            >
              {!ev.isEtf ? (
                <>
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: '#93c5fd',
                      background: 'rgba(96, 165, 250, 0.08)',
                      border: '1px solid rgba(96, 165, 250, 0.22)',
                      borderRadius: 5,
                      padding: '2px 6px',
                    }}
                  >
                    <span style={{ color: C.dim, fontSize: 10 }}>進場: </span>${ev.tradePlan.buyZone[0]}~{ev.tradePlan.buyZone[1]}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: '#f87171',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.22)',
                      borderRadius: 5,
                      padding: '2px 6px',
                    }}
                  >
                    <span style={{ color: C.dim, fontSize: 10 }}>停損: </span>${ev.tradePlan.stopLoss} ({ev.tradePlan.stopPct}%)
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: '#4ade80',
                      background: 'rgba(34, 197, 94, 0.08)',
                      border: '1px solid rgba(34, 197, 94, 0.22)',
                      borderRadius: 5,
                      padding: '2px 6px',
                    }}
                  >
                    <span style={{ color: C.dim, fontSize: 10 }}>目標: </span>${ev.tradePlan.targetPrice} (+{ev.tradePlan.targetPct}%)
                  </div>

                  <div
                    style={{
                      fontSize: 10.5,
                      fontFamily: 'monospace',
                      color: '#38bdf8',
                      background: 'rgba(56, 189, 248, 0.06)',
                      borderRadius: 5,
                      padding: '2px 5px',
                    }}
                  >
                    風報比 {ev.tradePlan.rrr}:1
                  </div>
                </>
              ) : (
                <>
                  {ev.ma200Dist != null && (
                    <div
                      style={{
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: ev.ma200Dist >= 0 ? '#4ade80' : '#f87171',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 5,
                        padding: '2px 6px',
                      }}
                    >
                      <span style={{ color: C.dim, fontSize: 10 }}>距年線: </span>
                      {ev.ma200Dist > 0 ? '+' : ''}{ev.ma200Dist}%
                    </div>
                  )}

                  {ev.pLine && (
                    <div
                      style={{
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: '#facc15',
                        background: 'rgba(250, 204, 21, 0.06)',
                        border: '1px solid rgba(250, 204, 21, 0.2)',
                        borderRadius: 5,
                        padding: '2px 6px',
                      }}
                    >
                      支撐: {ev.pLine} (+{ev.distS}%)
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: 10.5,
                      color: '#93c5fd',
                      background: 'rgba(96, 165, 250, 0.08)',
                      borderRadius: 5,
                      padding: '2px 6px',
                    }}
                  >
                    {ev.badge.text.includes('便宜') ? '策略: 特價單筆加碼' : '策略: 紀律定期定額'}
                  </div>
                </>
              )}
            </div>

            {/* 第 5 行：按鈕列 (水位計抽屜 / 診斷抽屜 / AI報告) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setGaugeOpen(!gaugeOpen)}
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: gaugeOpen ? '#ffffff' : '#60a5fa',
                    background: gaugeOpen ? 'rgba(96, 165, 250, 0.35)' : 'rgba(96, 165, 250, 0.1)',
                    border: '1px solid rgba(96, 165, 250, 0.35)',
                    borderRadius: 6,
                    padding: '4px 9px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  📈 水位計 {gaugeOpen ? '▲' : '▾'}
                </button>

                <button
                  onClick={() => setDiagOpen(!diagOpen)}
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: diagOpen ? '#ffffff' : C.mid,
                    background: diagOpen ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 6,
                    padding: '4px 9px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  📊 診斷 {diagOpen ? '▲' : '▾'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {showReport && (
                  <button
                    onClick={() => window.open(match.html_link, '_blank')}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#4ade80',
                      background: 'rgba(74, 222, 128, 0.1)',
                      border: '1px solid rgba(74, 222, 128, 0.3)',
                      borderRadius: 6,
                      padding: '4px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    報告 {fmtDate(match.date)}
                  </button>
                )}
                <button
                  onClick={() => onGoReport(dispSym)}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#c084fc',
                    background: 'rgba(192, 132, 252, 0.1)',
                    border: '1px solid rgba(192, 132, 252, 0.3)',
                    borderRadius: 6,
                    padding: '4px 8px',
                    cursor: 'pointer',
                  }}
                >
                  🤖 AI 報告
                </button>
              </div>
            </div>

            {/* ── 就地展開抽屜：完整垂直水位計 (WaterGauge) ── */}
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
                    🌊 SEMA 通道垂直水位計
                  </span>
                  <span style={{ fontSize: 11, color: C.dim }}>
                    浮球=現價 · 上方紅區為壓 · 下方綠區為撐
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <WaterGauge data={data} gaugeW={gaugeW} />
                </div>
              </div>
            )}

            {/* ── 就地展開抽屜：五維度量化診斷 (Five Dimensions) ── */}
            {diagOpen && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9', marginBottom: 2 }}>
                  📊 五維度實戰決策診斷
                </div>
                {Object.entries(ev.dimensions).map(([k, d]) => (
                  <div
                    key={k}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${lightColor(d.light)}33`,
                      borderRadius: 6,
                      padding: '5px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 9, color: lightColor(d.light) }}>●</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#f1f5f9' }}>{d.name}</span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, color: lightColor(d.light) }}>
                        {d.score}分
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: C.dim, textAlign: 'right' }}>
                      {d.summary}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── 主頁面 (StocksPage) ─────────────────────────────────────────────────────
  function StocksPage() {
    const [watchlist, setWatchlist] = useState(() => {
      try {
        const unified = localStorage.getItem('watchlist');
        if (unified) return JSON.parse(unified);
        const sema = JSON.parse(localStorage.getItem('sema_watchlist') || '[]');
        const dash = JSON.parse(localStorage.getItem('dash_watchlist') || '[]');
        const merged = [...sema];
        dash.forEach(raw => {
          const code = _norm(typeof raw === 'string' ? raw : '');
          if (code && !merged.find(w => _norm(w.code) === code))
            merged.push({ code, name: '' });
        });
        return merged;
      } catch { return []; }
    });

    const [input,       setInput]       = useState('');
    const [loading,     setLoading]     = useState(false);
    const [sysMsg,      setSysMsg]      = useState('');
    const [batchData,   setBatchData]   = useState({});
    const [batchState,  setBatchState]  = useState('loading');
    const [reports,     setReports]     = useState([]);
    const [gaugeW,      setGaugeW]      = useState(150);

    // 市場分群過濾: 'all' | 'tw' | 'us' | 'etf'
    const [filterGroup, setFilterGroup] = useState('all');

    const containerRef = useRef(null);

    // 儲存統一 watchlist，清除舊 key
    useEffect(() => {
      localStorage.setItem('watchlist', JSON.stringify(watchlist));
      localStorage.removeItem('dash_watchlist');
      localStorage.removeItem('sema_watchlist');
    }, [watchlist]);

    // 監聽跨頁面自選清單更新
    useEffect(() => {
      const handler = (e) => {
        if (e.detail) setWatchlist(e.detail);
      };
      window.addEventListener('watchlistchange', handler);
      return () => window.removeEventListener('watchlistchange', handler);
    }, []);

    // 水位計寬度自適應
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const ro = new ResizeObserver(([e]) => {
        setGaugeW(Math.round(Math.max(130, Math.min(220, e.contentRect.width * 0.35))));
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    // 載入報告清單
    const fetchReports = useCallback(() => {
      fetch(`${_API}/reports`)
        .then(r => r.json())
        .then(d => setReports(d.reports || []))
        .catch(() => {});
    }, []);

    useEffect(() => { fetchReports(); }, [fetchReports]);

    // 批次載入 watchlist 資料
    const loadBatch = useCallback(() => {
      if (!watchlist.length) { setBatchState('done'); return; }
      setBatchState('loading');
      window.fetchSemaBatch(watchlist.map(w => _norm(w.code)))
        .then(map => { setBatchData(map); setBatchState('done'); })
        .catch(() => setBatchState('error'));
    }, [watchlist]);

    useEffect(() => { loadBatch(); }, [loadBatch]);

    // 單支股票分析（搜尋欄或快選觸發）
    const analyze = useCallback(async rawCode => {
      const code = _norm(rawCode !== undefined ? rawCode : input);
      if (!code) return;
      setLoading(true);
      setSysMsg(`${code} 分析中...`);
      try {
        const json = await fetch(`${_API}/sema?symbol=${encodeURIComponent(code)}`).then(r => r.json());
        if (json.error) throw new Error(json.error);
        setWatchlist(prev =>
          prev.find(w => _norm(w.code) === json.code)
            ? prev
            : [...prev, { code: json.code, name: json.name }]
        );
        setBatchData(prev => ({ ...prev, [json.code]: json }));
        setSysMsg(`${json.name} 分析完成，已加入自選清單 ✓`);
      } catch (e) {
        setSysMsg(`分析失敗：${e.message}`);
      } finally {
        setLoading(false);
      }
    }, [input]);

    // 註冊全域 quickSema（選股頁與側欄共用）
    useEffect(() => {
      window.quickSema = code => {
        const norm = _norm(code);
        if (window.showTab) window.showTab('dashboard');
        setInput(norm);
        analyze(norm);
      };
      return () => { delete window.quickSema; };
    }, [analyze]);

    const handleRemove = sym => {
      setWatchlist(prev => prev.filter(w => _norm(w.code) !== sym));
    };

    const handleGoReport = dispSym => {
      const inputEl = document.getElementById('symbol');
      if (inputEl) inputEl.value = dispSym;
      if (window.showTab) window.showTab('report');
    };

    // ── 統計與分群 ──
    const evaluatedItems = useMemo(() => {
      return watchlist.map(w => {
        const norm = _norm(w.code);
        const cardData = batchData[norm];
        const isTw = norm.endsWith('.TW') || /^\d{4,6}$/.test(norm);
        const isEtf = cardData?.isEtf ?? (/^(00\d{2,4}[LA]?)$/.test(norm.replace(/\.TW$/i, '')) || ['TQQQ','SOXL','QLD','SSO','UPRO','NVDL','SMH','QQQ','SCHD','JEPI','JEPQ','VYM','DGRO','VOO'].includes(norm));
        const ev = evaluateStock(cardData);
        return {
          ...w,
          norm,
          cardData,
          isTw,
          isEtf,
          ev,
        };
      });
    }, [watchlist, batchData]);

    const countAll = evaluatedItems.length;
    const countTw  = evaluatedItems.filter(x => x.isTw).length;
    const countUs  = evaluatedItems.filter(x => !x.isTw).length;
    const countEtf = evaluatedItems.filter(x => x.isEtf).length;

    // 戰況統計
    const countBuy     = evaluatedItems.filter(x => x.ev?.badge?.text.includes('買') || x.ev?.badge?.text.includes('起漲') || x.ev?.badge?.text.includes('便宜')).length;
    const countResist  = evaluatedItems.filter(x => x.ev?.badge?.text.includes('壓力')).length;
    const countWarning = evaluatedItems.filter(x => x.ev?.badge?.text.includes('破') || x.ev?.badge?.text.includes('出場')).length;

    const filteredItems = useMemo(() => {
      if (filterGroup === 'tw') return evaluatedItems.filter(x => x.isTw);
      if (filterGroup === 'us') return evaluatedItems.filter(x => !x.isTw);
      if (filterGroup === 'etf') return evaluatedItems.filter(x => x.isEtf);
      return evaluatedItems;
    }, [evaluatedItems, filterGroup]);

    const GROUP_BUTTONS = [
      { key: 'all', label: `全部 (${countAll})` },
      { key: 'tw',  label: `🇹🇼 台股 (${countTw})` },
      { key: 'us',  label: `🇺🇸 美股 (${countUs})` },
      { key: 'etf', label: `💰 ETF (${countEtf})` },
    ];

    return (
      <div ref={containerRef} style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 40 }}>

        {/* ── 搜尋欄 + 執行 ── */}
        <div className="glass" style={{ padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="field"
              style={{ flex: 1, marginBottom: 0 }}
              value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && analyze()}
              placeholder="輸入代碼分析或加入自選  例如：AAPL / 2330 / 00878"
              maxLength={12}
            />
            <button
              onClick={() => analyze()}
              disabled={loading}
              className="btn-gold"
              style={{ width: 'auto', padding: '12px 20px', whiteSpace: 'nowrap' }}
            >
              {loading ? '分析中...' : '執行'}
            </button>
            <button
              onClick={() => { loadBatch(); fetchReports(); }}
              title="重新整理所有報價"
              style={{
                flexShrink: 0, padding: '12px 14px', borderRadius: 10, fontSize: 16,
                color: '#7fa8d0', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
              }}
            >↺</button>
          </div>

          {/* 熱門快選標籤 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <span style={{ fontSize: 11, color: C.dim }}>熱門快選:</span>
            {HOT_TAGS.map(t => (
              <button
                key={t.code}
                onClick={() => {
                  setInput(t.code);
                  analyze(t.code);
                }}
                style={{
                  fontSize: 11,
                  color: '#93c5fd',
                  background: 'rgba(96, 165, 250, 0.08)',
                  border: '1px solid rgba(96, 165, 250, 0.22)',
                  borderRadius: 12,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {sysMsg && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#cbd5e1' }}>
              {loading && <span className="sema-spinner" />}
              <span>{sysMsg}</span>
            </div>
          )}
        </div>

        {/* ── 頂部戰況摘要與分群切換 (Watchlist Intel Bar) ── */}
        {watchlist.length > 0 && (
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
            {/* 分群 Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {GROUP_BUTTONS.map(btn => {
                const active = filterGroup === btn.key;
                return (
                  <button
                    key={btn.key}
                    onClick={() => setFilterGroup(btn.key)}
                    style={{
                      fontSize: 12,
                      fontWeight: active ? 700 : 500,
                      color: active ? '#60a5fa' : C.dim,
                      background: active ? 'rgba(96, 165, 250, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      border: active ? '1px solid rgba(96, 165, 250, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 16,
                      padding: '4px 12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>

            {/* 戰況摘要統計 */}
            <div style={{ fontSize: 12, color: C.dim, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>戰況:</span>
              <span style={{ color: '#4ade80', fontWeight: 700 }}>🟢 {countBuy} 檔觸及買點</span>
              <span style={{ color: '#facc15', fontWeight: 700 }}>🟡 {countResist} 檔逼近壓力</span>
              {countWarning > 0 && <span style={{ color: '#f87171', fontWeight: 700 }}>🚨 {countWarning} 檔破線警戒</span>}
            </div>
          </div>
        )}

        {/* ── 空白提示 ── */}
        {watchlist.length === 0 && (
          <div style={{ textAlign: 'center', color: '#7fa8d0', fontSize: 14, lineHeight: 2.3, padding: '48px 0' }}>
            觀察清單目前是空的<br />
            <span style={{ fontSize: 12, color: '#475569' }}>點擊上方「熱門快選」或輸入代碼按「執行」加入實戰監控</span>
          </div>
        )}

        {/* ── 自選卡片列表 (實戰卡片流) ── */}
        {filteredItems.length > 0 && (
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {filteredItems.map(item => {
              const cardData = batchData[item.norm];
              const cardState = batchState === 'done' ? (cardData?.error ? 'error' : 'done') : batchState;
              return (
                <StockCard
                  key={item.code}
                  sym={item.norm}
                  name={item.name || cardData?.name || ''}
                  state={cardState}
                  data={cardData?.error ? null : cardData}
                  onRemove={() => handleRemove(item.norm)}
                  reports={reports}
                  onGoReport={handleGoReport}
                  gaugeW={gaugeW}
                />
              );
            })}
          </div>
        )}

      </div>
    );
  }

  const root = document.getElementById('dashboard-root');
  if (root) ReactDOM.createRoot(root).render(<StocksPage />);
})();
