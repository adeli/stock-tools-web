import React from 'react';
import ReactDOM from 'react-dom/client';
import { WORKER_URL } from './app.js';
import { getChangeColor, getWatchlist, addToWatchlist, removeFromWatchlist } from './utils.js';

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

  const CORE_US_ETFS_DEF = [
    { code: 'TQQQ', name: 'ProShares 納指3倍做多', rs_rating: 85, isLeverage: true },
    { code: 'SOXL', name: 'Direxion 半導體3倍做多', rs_rating: 99, isLeverage: true },
    { code: 'QLD',  name: 'ProShares 納指2倍做多', rs_rating: 64, isLeverage: true },
    { code: 'SSO',  name: 'ProShares 標普2倍做多', rs_rating: 57, isLeverage: true },
    { code: 'UPRO', name: 'ProShares 標普3倍做多', rs_rating: 71, isLeverage: true },
    { code: 'NVDL', name: 'GraniteShares 輝達2倍做多', rs_rating: 65, isLeverage: true },
    { code: 'SMH',  name: 'VanEck 半導體 ETF', rs_rating: 92, isLeverage: false },
    { code: 'QQQ',  name: 'Invesco 納斯達克100 ETF', rs_rating: 50, isLeverage: false },
    { code: 'SCHD', name: 'Schwab 美國股息股票 ETF', rs_rating: 78, dividend: { yield_pct: 3.5, freq: '季配' } },
    { code: 'JEPI', name: 'JPMorgan 股票溢價收益 ETF', rs_rating: 45, dividend: { yield_pct: 8.2, freq: '月配' } },
    { code: 'JEPQ', name: 'JPMorgan 納斯達克溢價 ETF', rs_rating: 55, dividend: { yield_pct: 9.5, freq: '月配' } },
    { code: 'VYM',  name: 'Vanguard 高股利收益 ETF', rs_rating: 40, dividend: { yield_pct: 3.0, freq: '季配' } },
    { code: 'DGRO', name: 'iShares 核心股息成長 ETF', rs_rating: 48, dividend: { yield_pct: 2.4, freq: '季配' } },
    { code: 'VOO',  name: 'Vanguard 標普500 ETF', rs_rating: 50, dividend: { yield_pct: 1.4, freq: '季配' } },
  ];

  const CORE_TW_ETFS_DEF = [
    { code: '0050',   name: '元大台灣50', rs_rating: 80, dividend: { yield_pct: 1.5, freq: '半年配' } },
    { code: '006208', name: '富邦台灣50', rs_rating: 80, dividend: { yield_pct: 1.6, freq: '半年配' } },
    { code: '00631L', name: '元大台灣50正2', rs_rating: 99, isLeverage: true },
    { code: '00670L', name: '富邦NASDAQ正2', rs_rating: 60, isLeverage: true },
    { code: '00878',  name: '國泰永續高股息', rs_rating: 71, dividend: { yield_pct: 7.1, freq: '季配' } },
    { code: '0056',   name: '元大高股息', rs_rating: 85, dividend: { yield_pct: 8.7, freq: '季配' } },
    { code: '00919',  name: '群益台灣精選高息', rs_rating: 65, dividend: { yield_pct: 10.4, freq: '季配' } },
    { code: '00929',  name: '復華台灣科技優息', rs_rating: 45, dividend: { yield_pct: 8.9, freq: '月配' } },
  ];

  const BENCHMARK_TW_STOCKS_DEF = [
    { code: '2330', name: '台積電', rs_rating: 92, eps: { growth_pct: 91.6, valid: true } },
    { code: '2454', name: '聯發科', rs_rating: 86, eps: { growth_pct: 35.0, valid: true } },
    { code: '2317', name: '鴻海',   rs_rating: 88, eps: { growth_pct: 28.5, valid: true } },
  ];

  const BENCHMARK_US_STOCKS_DEF = [
    { code: 'NVDA', name: 'NVIDIA 輝達', rs_rating: 95, eps: { growth_pct: 122.0, valid: true } },
    { code: 'AAPL', name: 'Apple 蘋果',   rs_rating: 82, eps: { growth_pct: 12.0, valid: true } },
  ];

  function fmtDate(iso) {
    if (!iso) return null;
    const d = new Date(iso), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // ── 五維評估與交易計畫 Client-side fallback ─────────────────────────────────────
  function buildEval(r, setup, chips, regime) {
    if (r.eval) return r.eval;
    const price = r.price || r.sema_data?.price || 0;
    const isTw = (r.code && /^\d+/.test(r.code)) || r.code?.endsWith('.TW') || r.code?.endsWith('.TWO');
    const isEtf = r.source === 'etf' || /^(00\d{2,4}[LA]?)$/.test(r.code);
    const rs = r.rs_rating || 50;

    // 1. 大盤
    const regLevel = regime?.level || 'BULL_STRONG';
    const regDiff = regime?.diff_ma50_pct != null ? regime.diff_ma50_pct : 2.5;
    let mScore = 92, mLight = 'GREEN', mDesc = `大盤站穩季線 (${regDiff >= 0 ? '+' : ''}${regDiff}%) · 順風環境適合積極操作`;
    if (regLevel === 'BULL_MILD') {
      mScore = 82; mLight = 'GREEN'; mDesc = `大盤溫和偏多 · 順勢佈局強勢股`;
    } else if (regLevel === 'CHOPPY') {
      mScore = 62; mLight = 'YELLOW'; mDesc = `大盤震盪盤整 · 縮小部位並嚴格防守`;
    } else if (regLevel === 'BEAR') {
      mScore = 38; mLight = 'RED'; mDesc = `大盤空頭破線 · 系統性風險高，建議保留現金`;
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
      tScore = 55; tLight = 'YELLOW'; tDesc = `季線乖離過大 (+${setup?.bias_ma50}%) · 避免追高，等待拉回`;
    }

    // 3. 籌碼
    let cScore = 70, cLight = 'YELLOW', cDesc = `籌碼平穩維持常態`;
    if (isTw && !isEtf) {
      const itDays = chips?.it_consec_days || 0;
      const itLots = chips?.it_net_lots_5d || 0;
      if (itDays >= 5 || chips?.is_it_hot) {
        cScore = 94; cLight = 'GREEN'; cDesc = `投信連買 ${itDays} 天 (5日累計 ${itLots.toLocaleString()} 張) · 法人大戶積極認養`;
      } else if (itDays >= 3) {
        cScore = 85; cLight = 'GREEN'; cDesc = `投信連買 ${itDays} 天 · 籌碼集中沉澱`;
      } else if (itDays >= 1) {
        cScore = 75; cLight = 'GREEN'; cDesc = `投信小幅買超偏多`;
      }
    } else {
      if (rs >= 88) {
        cScore = 92; cLight = 'GREEN'; cDesc = `RS評級 ${rs} · 機構高度認養之市場領頭羊`;
      } else if (rs >= 80) {
        cScore = 84; cLight = 'GREEN'; cDesc = `RS評級 ${rs} · 動能超越全市場 80% 標的`;
      }
    }

    // 4. 基本面
    const gp = r.eps?.growth_pct;
    const yp = r.dividend?.yield_pct;
    let fScore = 75, fLight = 'GREEN', fDesc = `營運維持常態水準`;
    if (gp != null && gp >= 25) {
      fScore = 90; fLight = 'GREEN'; fDesc = `EPS 年增率 +${gp.toFixed(0)}% · 獲利加速爆發`;
    } else if (gp != null && gp > 0) {
      fScore = 80; fLight = 'GREEN'; fDesc = `EPS 年增率 +${gp.toFixed(0)}% · 基本面維持正成長`;
    } else if (yp != null && yp >= 4.5) {
      fScore = 86; fLight = 'GREEN'; fDesc = `預估年化殖利率 ${yp}% · 高股息防禦下檔保護`;
    } else if (isEtf) {
      fScore = 82; fLight = 'GREEN'; fDesc = `優質指數商品 · 分散單一持股營運風險`;
    }

    // 5. 風報比精算
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
      rDesc = `風報比 ${rrr}:1 · 建議貼近支撐位再進場`;
    }

    const buyMin = Number((price * 0.992).toFixed(price >= 50 ? 1 : 2));
    const buyMax = Number((price * 1.005).toFixed(price >= 50 ? 1 : 2));

    const lights = [mLight, tLight, cLight, fLight, rLight];
    const greenCount = lights.filter(l => l === 'GREEN').length;
    const totalScore = Math.round(mScore * 0.2 + tScore * 0.25 + cScore * 0.2 + fScore * 0.15 + rScore * 0.2);

    let verdict = 'BUY', verdictDesc = `建議分批買進 (${greenCount}/5 綠燈 · 評分 ${totalScore})`;
    let posPct = 25;
    if (greenCount >= 4 && totalScore >= 80) {
      verdict = 'BUY'; posPct = regLevel === 'BULL_STRONG' ? 25 : 15;
    } else if (greenCount >= 3 && totalScore >= 70) {
      verdict = 'WAIT'; verdictDesc = `逢回分批布局 (${greenCount}/5 綠燈 · 評分 ${totalScore})`;
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
        ['SEMA1', 'SEMA2', 'SEMA3', 'SEMA4', 'SEMA5', 'SEMA6'].includes(pLine) &&
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

    const isTw = (r.code && /^\d+/.test(r.code)) || r.code?.endsWith('.TW') || r.code?.endsWith('.TWO');
    const isEtf = r.source === 'etf' || /^(00\d{2,4}[LA]?)$/.test(r.code);
    const evalData = r.eval || buildEval(r, setup, chips, regime);

    // 计算 SEMA8 (年线/200MA) 偏离
    const s8 = allSemas.find(s => s.label === 'SEMA8');
    const ma200_dist = s8 ? Number(((price - s8.value) / s8.value * 100).toFixed(1)) : null;

    return {
      ...r,
      isTw,
      isEtf,
      setup,
      chips,
      eval: evalData,
      ma200_dist,
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

  // ── 智能多維度風報比評級 (避免優質成長股/ETF被誤標為勿追) ──
  function evaluateRrrGrade(rrr, { isEtf, ma200Dist, belowSupport, isExtended, isSb, isPb, trendTemplate, rsRating, epsGrowth }) {
    const r = Number(rrr || 2.0);
    if (r >= 2.5) {
      return {
        text: '短波極佳',
        color: '#4ade80',
        bg: 'rgba(74, 222, 128, 0.08)',
        border: 'rgba(74, 222, 128, 0.25)',
        tooltip: `風報比 ${r}:1【短波極佳】\n• 冒 1 元風險搏 ${r} 元利潤，勝率 28% 即可保本，高期望值首選。\n• 停損僅 -1.5%~-2%，向上波段目標明確。`,
      };
    }
    if (r >= 1.8) {
      return {
        text: '合理試單',
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.08)',
        border: 'rgba(56, 189, 248, 0.25)',
        tooltip: `風報比 ${r}:1【合理試單】\n• 冒 1 元風險搏 ${r} 元利潤，勝率 35% 即保本。\n• 符合專業機構盈虧比門檻，可分批布局。`,
      };
    }
    // RRR < 1.8: 區分「走下坡破線」vs「乖離過大」vs「優質股/ETF長線整理買點」
    if (belowSupport || (ma200Dist != null && ma200Dist < 0)) {
      return {
        text: '破線偏弱',
        color: '#f87171',
        bg: 'rgba(248, 113, 113, 0.08)',
        border: 'rgba(248, 113, 113, 0.25)',
        tooltip: `風報比 ${r}:1【破線偏弱 · 觀望勿抄底】\n• 股價已跌破重要支撐或年線，處於走下坡或不穩定弱勢結構。\n• 停損風險偏高且反彈動能不明，嚴守紀律不宜貿然抄底。`,
      };
    }
    if (isExtended) {
      return {
        text: '乖離過大',
        color: '#fb923c',
        bg: 'rgba(251, 146, 60, 0.08)',
        border: 'rgba(251, 146, 60, 0.25)',
        tooltip: `風報比 ${r}:1【乖離過大 · 耐心等拉回】\n• 股價脫離均線過遠 (+25%以上)，高檔獲利了結賣壓沉重。\n• 追高盈虧比極差，建議耐心等待回測均線守穩再進場。`,
      };
    }
    const isQuality = isEtf || (rsRating != null && rsRating >= 75) || trendTemplate || (epsGrowth != null && epsGrowth > 0) || isSb || isPb;
    if (isQuality) {
      return {
        text: '長線布局',
        color: '#a78bfa',
        bg: 'rgba(167, 139, 250, 0.08)',
        border: 'rgba(167, 139, 250, 0.25)',
        tooltip: `風報比 ${r}:1【長線布局 · 遇壓整理】\n• 中長線多頭與基本面體質優良，短線靠近前高或阻力整理，短波盈虧比暫受限。\n• 對中長線或定時定額投資人而言，拉回支撐反而是優質分批低接買點！`,
      };
    }
    return {
      text: '空間受限',
      color: '#fbbf24',
      bg: 'rgba(251, 191, 36, 0.08)',
      border: 'rgba(251, 191, 36, 0.25)',
      tooltip: `風報比 ${r}:1【短線空間受限 · 分批低接】\n• 距離上方壓力較近，短波衝刺獲利空間較窄。\n• 建議等待更接近下方支撐線時再行低接。`,
    };
  }

  // ── Apple 風格「極簡實戰卡片」 (ActionCard) ──────────────────────────────────
  function ActionCard({ r, strategy, onView }) {
    const [detailOpen, setDetailOpen] = useState(false);

    const isTw = r.isTw;
    const dispCode = r.code ? r.code.replace(/\.TW$/i, '') : '';
    const price = r.price || r.sema_data?.price || 0;
    const chg = r.changePct;
    const ev = r.eval || {};
    const tp = ev.trade_plan || {};
    const setup = r.setup || {};
    const sd = r.sema_data || {};
    const d = r.dividend;

    // 狀態標籤判斷 (Badge)
    let badge = { text: '🟢 建議買進', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.12)', border: 'rgba(74, 222, 128, 0.4)' };

    if (strategy === 'short') {
      if (setup.is_short_bounce || (setup.dist_support_pct != null && setup.dist_support_pct <= 1.5)) {
        badge = { text: '🔥 低點起漲', color: '#fb7185', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.45)' };
      } else if (setup.is_pullback_buy || (setup.dist_support_pct != null && setup.dist_support_pct <= 3.0)) {
        badge = { text: '🎯 回測買點', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.15)', border: 'rgba(74, 222, 128, 0.4)' };
      } else {
        badge = { text: '⚡ 蓄勢觀察', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)', border: 'rgba(96, 165, 250, 0.4)' };
      }
    } else if (strategy === 'etf_save') {
      if (r.ma200_dist != null && r.ma200_dist < 0) {
        badge = { text: '⚠️ 破年線觀望', color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)', border: 'rgba(248, 113, 113, 0.4)' };
      } else if ((setup.dist_support_pct != null && setup.dist_support_pct <= 2.2) || (setup.bias_ma50 != null && setup.bias_ma50 < 3.0)) {
        badge = { text: '💎 便宜加碼點', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.15)', border: 'rgba(74, 222, 128, 0.4)' };
      } else if (setup.is_extended) {
        badge = { text: '⏸ 偏高暫停加碼', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.4)' };
      } else {
        badge = { text: '✓ 定期定額 (合理)', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)' };
      }
    } else {
      // Trend
      if (setup.is_extended) {
        badge = { text: '🚨 乖離過大', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.4)' };
      } else if (ev.verdict === 'BUY' || (r.rs_rating >= 88 && setup.is_pullback_buy)) {
        badge = { text: '🟢 建議買進', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.15)', border: 'rgba(74, 222, 128, 0.4)' };
      } else if (ev.verdict === 'WAIT' || setup.is_pullback_buy) {
        badge = { text: '🟡 逢回布局', color: '#facc15', bg: 'rgba(250, 204, 21, 0.15)', border: 'rgba(250, 204, 21, 0.4)' };
      } else {
        badge = { text: '🌊 強勢多頭', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)' };
      }
    }

    // 核心理由一句話 (Rationale)
    let rationale = '';
    if (strategy === 'short') {
      const line = setup.pullback_line || 'SEMA2';
      const dist = setup.dist_support_pct != null ? `${setup.dist_support_pct}%` : '2.0%';
      const vol45 = sd.vol45Ratio != null ? ` · 45日量比 ${sd.vol45Ratio}× ${sd.vol45Ratio <= 0.85 ? '極致量縮' : '洗盤縮量'}` : '';
      rationale = `🔥 回測 ${line} 支撐守穩 (+${dist})${vol45} · 尾盤買盤承接，短線反彈動能蓄積`;
    } else if (strategy === 'etf_save') {
      const yieldPct = r.dividend?.yield_pct ?? (
        r.code === 'SCHD' ? 3.5 :
        r.code === 'JEPI' ? 8.2 :
        r.code === 'JEPQ' ? 9.5 :
        r.code === 'VYM'  ? 3.0 :
        r.code === 'VOO'  ? 1.4 : null
      );
      const freq = r.dividend?.freq || (['JEPI','JEPQ'].includes(dispCode) ? '月配' : '季配');
      const yieldStr = yieldPct != null ? `年化殖利率 ${yieldPct}% (${freq})` : '優質核心指數商品';
      const ma200Str = r.ma200_dist != null ? ` · 距年線 ${r.ma200_dist > 0 ? '+' : ''}${r.ma200_dist}%` : '';
      const actionTip = badge.text.includes('便宜') ? ' · 均線拉回特價甜甜價，建議把握加碼' : ' · 站在年線之上，維持紀律定期定額';
      rationale = `💰 ${yieldStr}${ma200Str}${actionTip}`;
    } else {
      const rsStr = r.rs_rating ? `RS評級 ${r.rs_rating}` : '';
      const epsStr = r.eps?.growth_pct ? ` · EPS YoY +${r.eps.growth_pct.toFixed(0)}%` : '';
      const chipsStr = r.chips?.it_consec_days >= 2 ? ` · 投信連${r.chips.it_consec_days}買` : '';
      const trendStr = setup.trend_template ? ' · 均線多頭排列架構' : ' · 站穩短均線上行';
      rationale = `🌊 ${rsStr}${trendStr}${epsStr}${chipsStr}`;
    }

    // 實戰數據數值 (Line 3 metrics)
    const isEtfSave = strategy === 'etf_save';
    const buyMin = tp.buy_zone ? tp.buy_zone[0] : (price * 0.992).toFixed(1);
    const buyMax = tp.buy_zone ? tp.buy_zone[1] : (price * 1.005).toFixed(1);
    const stopLoss = tp.stop_loss || (price * 0.985).toFixed(1);
    const stopPct = tp.stop_pct || -1.5;
    const targetPrice = tp.target_price || (price * 1.045).toFixed(1);
    const targetPct = tp.target_pct || +4.5;
    const rrr = tp.rrr || 2.5;
    const rrrGrade = evaluateRrrGrade(rrr, {
      isEtf: r.isEtf || isEtfSave,
      ma200Dist: r.ma200_dist,
      belowSupport: sd.belowSema3,
      isExtended: setup.is_extended,
      isSb: setup.is_short_bounce,
      isPb: setup.is_pullback_buy,
      trendTemplate: setup.trend_template,
      rsRating: r.rs_rating,
      epsGrowth: r.eps?.growth_pct,
    });

    // ETF 存股數據
    const etfYield = r.dividend?.yield_pct ?? (
      r.code === 'SCHD' ? 3.5 :
      r.code === 'JEPI' ? 8.2 :
      r.code === 'JEPQ' ? 9.5 :
      r.code === 'VYM'  ? 3.0 :
      r.code === 'VOO'  ? 1.4 : null
    );
    const etfFreq = r.dividend?.freq || (['JEPI','JEPQ'].includes(dispCode) ? '月配' : '季配');

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

    const [tw, setTw] = useState({ data: null, loading: false, error: null });
    const [us, setUs] = useState({ data: null, loading: false, error: null });
    const [liveEtfs, setLiveEtfs] = useState({});
    const [liveLoading, setLiveLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // 載入資料
    const loadMarket = useCallback(async (mkt) => {
      const setter = mkt === 'tw' ? setTw : setUs;
      setter(s => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch(`${WORKER_URL}/screener?market=${mkt}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setter({ data: json, loading: false, error: null });
      } catch (e) {
        setter(s => ({ ...s, loading: false, error: e.message }));
      }
    }, []);

    const loadAll = useCallback(() => {
      loadMarket('tw');
      loadMarket('us');
    }, [loadMarket]);

    useEffect(() => {
      loadAll();
      window.screenerLoad = loadAll;
      return () => { window.screenerLoad = null; };
    }, [loadAll]);

    // 即時補充核心 ETF 與權值股的 SEMA 批次資料
    useEffect(() => {
      const currentUsCodes = (us.data?.results || []).map(r => r.code);
      const currentTwCodes = (tw.data?.results || []).map(r => r.code);

      const missingUs = [
        ...CORE_US_ETFS_DEF.filter(x => !currentUsCodes.includes(x.code)).map(x => x.code),
        ...BENCHMARK_US_STOCKS_DEF.filter(x => !currentUsCodes.includes(x.code)).map(x => x.code),
      ];
      const missingTw = [
        ...CORE_TW_ETFS_DEF.filter(x => !currentTwCodes.includes(x.code)).map(x => `${x.code}.TW`),
        ...BENCHMARK_TW_STOCKS_DEF.filter(x => !currentTwCodes.includes(x.code)).map(x => `${x.code}.TW`),
      ];
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

    const onRefresh = async () => {
      setRefreshing(true);
      await Promise.all([loadMarket('tw'), loadMarket('us')]);
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

    // 依策略分類池子
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
        return (a.setup?.dist_support_pct || 999) - (b.setup?.dist_support_pct || 999);
      });

      // 2. 波段強勢: RS >= 80 或是指數型龍頭 (0050, 006208, VOO, QQQ 等) 處於多頭架構
      const trend = fullList.filter(r => {
        if (r.isEtf && ['TQQQ','SOXL','UPRO'].includes(r.code)) return false; // 槓桿歸類在短線
        if (['0050','006208','QQQ','VOO','SPY'].includes(r.code) && (r.setup?.trend_template || (r.setup?.dist_support_pct != null && r.setup.dist_support_pct <= 4.0))) return true;
        return (r.rs_rating >= 80) || (r.setup?.trend_template && r.setup?.is_pullback_buy);
      }).sort((a, b) => (b.rs_rating || 0) - (a.rs_rating || 0));

      // 3. ETF 存股: 高股息與優質核心市值型 ETF (排除正2/正3槓桿型)
      const save = fullList.filter(r => {
        if (!r.isEtf) return false;
        if (['TQQQ','SOXL','QLD','SSO','UPRO','NVDL','00631L','00670L'].includes(r.code)) return false;
        return true;
      }).sort((a, b) => {
        const aCheap = (a.setup?.dist_support_pct != null && a.setup.dist_support_pct <= 2.2) ? 1 : 0;
        const bCheap = (b.setup?.dist_support_pct != null && b.setup.dist_support_pct <= 2.2) ? 1 : 0;
        if (bCheap !== aCheap) return bCheap - aCheap;
        return (b.dividend?.yield_pct || 0) - (a.dividend?.yield_pct || 0);
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

    const isLoading = (tw.loading || us.loading) && displayedResults.length === 0;
    const scanDate = fmtDate(tw.data?.scanned_at || us.data?.scanned_at);

    // 策略按鈕選項
    const STRATEGY_BUTTONS = [
      { key: 'short',    icon: '⚡', title: '短線快打', count: shortPool.length, desc: '1~2天高勝率起漲' },
      { key: 'trend',    icon: '🌊', title: '波段強勢', count: trendPool.length, desc: 'RS頂尖動能主流' },
      { key: 'etf_save', icon: '💰', title: 'ETF 存股', count: savePool.length, desc: '高息穩健長期累積' },
    ];

    const MARKET_BUTTONS = [
      { key: 'all', label: `全部 (${currentAllCount})` },
      { key: 'tw',  label: `🇹🇼 台股 (${currentTwCount})` },
      { key: 'us',  label: `🇺🇸 美股 (${currentUsCount})` },
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
