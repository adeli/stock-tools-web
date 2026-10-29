// ── 統一五維度量化診斷與作戰評估引擎 (Unified Stock Evaluator) ─────────────────
// 保證「個股儀表板」與「選股頁面」對同一支股票的標籤、理由、評分、五維診斷 100% 一致

export const CORE_US_ETFS_DEF = [
  // 市值成長型
  { code: 'VOO',  name: 'Vanguard 標普500 ETF', category: 'growth', tier: 'core', rs_rating: 72, dividend: { yield_pct: 1.4, freq: '季配', months: [3, 6, 9, 12] }, desc: '全美500大企業精華 · 長線複利首選' },
  { code: 'VTI',  name: 'Vanguard 全市場股票 ETF', category: 'growth', tier: 'core', rs_rating: 74, dividend: { yield_pct: 1.4, freq: '季配', months: [3, 6, 9, 12] }, desc: '全美3,600+大中小型企業 · 最全方位資產配置基石' },
  { code: 'QQQ',  name: 'Invesco 納斯達克100 ETF', category: 'growth', tier: 'core', rs_rating: 80, dividend: { yield_pct: 0.6, freq: '季配', months: [3, 6, 9, 12] }, desc: '科技巨頭聚集 · 美股頂尖成長引擎' },
  { code: 'SPY',  name: 'SPDR 標普500 ETF', category: 'growth', tier: 'core', rs_rating: 72, dividend: { yield_pct: 1.2, freq: '季配', months: [3, 6, 9, 12] }, desc: '全球流動性最大 · 標普500旗艦' },
  { code: 'SMH',  name: 'VanEck 半導體 ETF', category: 'growth', tier: 'core', rs_rating: 88, dividend: { yield_pct: 0.8, freq: '年配', months: [12] }, desc: '全球半導體龍頭 · AI晶片硬體核心' },
  { code: 'SOXX', name: 'iShares 半導體 ETF', category: 'growth', tier: 'dynamic', rs_rating: 86, dividend: { yield_pct: 0.7, freq: '季配', months: [3, 6, 9, 12] }, desc: '費城半導體指數旗艦 · AI與晶片硬體動態精選' },
  { code: 'VT',   name: 'Vanguard 全球股票 ETF', category: 'growth', tier: 'dynamic', rs_rating: 70, dividend: { yield_pct: 1.9, freq: '季配', months: [3, 6, 9, 12] }, desc: '涵蓋全世界9,000+企業 · 跨國地緣風險分散' },
  // 高股息現金流型 (含月配與週配)
  { code: 'SCHD', name: 'Schwab 美國股息股票 ETF', category: 'dividend', tier: 'core', rs_rating: 78, dividend: { yield_pct: 3.5, freq: '季配', months: [3, 6, 9, 12], fill_rate: '100% 填息' }, desc: '高殖利率兼顧基本面成長 · 美股存股首選' },
  { code: 'JEPI', name: 'JPMorgan 股票溢價收益 ETF', category: 'dividend', tier: 'core', rs_rating: 45, dividend: { yield_pct: 8.2, freq: '月配', months: [1,2,3,4,5,6,7,8,9,10,11,12], fill_rate: '月月領息' }, desc: '標普500掩護性買權 · 高額月現金流' },
  { code: 'JEPQ', name: 'JPMorgan 納斯達克股票溢價 ETF', category: 'dividend', tier: 'core', rs_rating: 55, dividend: { yield_pct: 9.5, freq: '月配', months: [1,2,3,4,5,6,7,8,9,10,11,12], fill_rate: '月月領息' }, desc: '納指100掩護性買權 · 科技高配息月配' },
  { code: 'XDTE', name: 'Roundhill 標普500 0DTE 週配息 ETF', category: 'dividend', tier: 'core', rs_rating: 70, dividend: { yield_pct: 18.5, freq: '週配', months: [1,2,3,4,5,6,7,8,9,10,11,12], fill_rate: '每週五發薪' }, desc: '每日賣標普500當日到期買權 · ~18%高額週配現金流' },
  { code: 'QDTE', name: 'Roundhill 納指100 0DTE 週配息 ETF', category: 'dividend', tier: 'core', rs_rating: 75, dividend: { yield_pct: 26.5, freq: '週配', months: [1,2,3,4,5,6,7,8,9,10,11,12], fill_rate: '每週五發薪' }, desc: '每日賣納指100當日到期買權 · ~26%科技高配息週配' },
  { code: 'VYM',  name: 'Vanguard 高股利收益 ETF', category: 'dividend', tier: 'core', rs_rating: 40, dividend: { yield_pct: 3.0, freq: '季配', months: [3, 6, 9, 12] }, desc: '老牌穩健高息 · 涵蓋全美優質高息企業' },
  { code: 'DGRO', name: 'iShares 核心股息成長 ETF', category: 'dividend', tier: 'core', rs_rating: 48, dividend: { yield_pct: 2.4, freq: '季配', months: [3, 6, 9, 12] }, desc: '連續配息增長公司 · 股息成長典範' },
  { code: 'MSTY', name: 'YieldMax MSTR 選擇權高收益 ETF', category: 'dividend', tier: 'dynamic', rs_rating: 68, dividend: { yield_pct: 65.0, freq: '週配', fill_rate: '每週四發薪 (年52次)' }, desc: '微策略比特幣持倉掩護買權 · 超高現金流週配衛星配置' },
  // 債券防禦型 (含短債資金停泊)
  { code: 'SGOV', name: 'iShares 0-3月短期美債 ETF', category: 'bond', tier: 'core', rs_rating: 40, dividend: { yield_pct: 5.1, freq: '月配', months: [1,2,3,4,5,6,7,8,9,10,11,12], fill_rate: '月月領息' }, desc: '超短期美國國庫券 · ~5.1%穩健息率 · 資金極致避風港' },
  { code: 'TLT',  name: 'iShares 20年期以上美國公債 ETF', category: 'bond', tier: 'core', rs_rating: 35, dividend: { yield_pct: 4.6, freq: '月配', months: [1,2,3,4,5,6,7,8,9,10,11,12] }, desc: '長天期美債 · 股災防禦與降息受惠' },
  { code: 'BND',  name: 'Vanguard 總體債券市場 ETF', category: 'bond', tier: 'core', rs_rating: 38, dividend: { yield_pct: 4.4, freq: '月配', months: [1,2,3,4,5,6,7,8,9,10,11,12] }, desc: '全方位投資級債券 · 資產配置穩健定海神針' },
  // 槓桿型 (保留供查詢)
  { code: 'TQQQ', name: 'ProShares 納指3倍做多', category: 'leverage', tier: 'core', rs_rating: 85, isLeverage: true },
  { code: 'SOXL', name: 'Direxion 半導體3倍做多', category: 'leverage', tier: 'core', rs_rating: 99, isLeverage: true },
  { code: 'QLD',  name: 'ProShares 納指2倍做多', category: 'leverage', tier: 'core', rs_rating: 80, isLeverage: true },
  { code: 'SSO',  name: 'ProShares 標普2倍做多', category: 'leverage', tier: 'core', rs_rating: 70, isLeverage: true },
  { code: 'UPRO', name: 'ProShares 標普3倍做多', category: 'leverage', tier: 'core', rs_rating: 75, isLeverage: true },
  { code: 'NVDL', name: 'GraniteShares 輝達2倍做多', category: 'leverage', tier: 'core', rs_rating: 98, isLeverage: true },
];

export const CORE_TW_ETFS_DEF = [
  // 市值成長型
  { code: '0050',   name: '元大台灣50', category: 'growth', tier: 'core', rs_rating: 80, dividend: { yield_pct: 1.5, freq: '半年配', months: [1, 7], last_amt: 1.00, fill_rate: '100% 填息 (平均15天)' }, desc: '台灣前50大權值巨頭 · 經濟成長同軌複利' },
  { code: '006208', name: '富邦台灣50', category: 'growth', tier: 'core', rs_rating: 80, dividend: { yield_pct: 1.6, freq: '半年配', months: [7, 11], last_amt: 0.90, fill_rate: '100% 填息' }, desc: '超低內扣費用 · 小資定期定額首選' },
  // 高股息現金流型
  { code: '00878',  name: '國泰永續高股息', category: 'dividend', tier: 'core', rs_rating: 71, dividend: { yield_pct: 7.1, freq: '季配', months: [2, 5, 8, 11], last_amt: 0.55, fill_rate: '100% 填息 (平均8天)' }, desc: '百萬股民高人氣 · ESG永續兼顧抗跌低波' },
  { code: '0056',   name: '元大高股息', category: 'dividend', tier: 'core', rs_rating: 85, dividend: { yield_pct: 8.7, freq: '季配', months: [1, 4, 7, 10], last_amt: 1.07, fill_rate: '100% 填息 (平均14天)' }, desc: '歷史最悠久高息旗艦 · 連續14年填息紀錄' },
  { code: '00919',  name: '群益台灣精選高息', category: 'dividend', tier: 'core', rs_rating: 65, dividend: { yield_pct: 10.4, freq: '季配', months: [3, 6, 9, 12], last_amt: 0.72, fill_rate: '100% 填息 (平均28天)' }, desc: '強悍10%+高配息 · 宣告高息股精準納入' },
  { code: '00713',  name: '元大台灣高息低波', category: 'dividend', tier: 'core', rs_rating: 75, dividend: { yield_pct: 6.8, freq: '季配', months: [3, 6, 9, 12], last_amt: 1.50, fill_rate: '100% 填息 (平均12天)' }, desc: '多空歷練最佳防守王 · 股災抗震獲利穩' },
  { code: '00929',  name: '復華台灣科技優息', category: 'dividend', tier: 'core', rs_rating: 45, dividend: { yield_pct: 8.9, freq: '月配', months: [1,2,3,4,5,6,7,8,9,10,11,12], last_amt: 0.11, fill_rate: '月月領息' }, desc: '首檔台股月配息 · 科技成長與現金流兼顧' },
  { code: '00918',  name: '大華優利高填息30', category: 'dividend', tier: 'core', rs_rating: 70, dividend: { yield_pct: 12.1, freq: '季配', months: [3, 6, 9, 12], last_amt: 0.78, fill_rate: '高填息篩選' }, desc: '專注歷史填息率 · 拒絕貼息陷阱' },
  { code: '00938',  name: '凱基優選30', category: 'dividend', tier: 'core', rs_rating: 60, dividend: { yield_pct: 3.4, freq: '季配', months: [3, 6, 9, 12], last_amt: 0.23 }, desc: '優選高獲利企業 · 價值成長配置' },
  { code: '00939',  name: '統一台灣高息動能', category: 'dividend', tier: 'core', rs_rating: 50, dividend: { yield_pct: 4.3, freq: '月配', months: [1,2,3,4,5,6,7,8,9,10,11,12], last_amt: 0.06 }, desc: '月底領息平衡發薪日 · 科技動能加碼' },
  // 債券防禦型
  { code: '00679B', name: '元大美債20年', category: 'bond', tier: 'core', rs_rating: 40, dividend: { yield_pct: 4.7, freq: '季配', months: [2, 5, 8, 11] }, desc: '美國20年期長天期公債 · 股災防禦資產' },
  { code: '00687B', name: '國泰20年美債', category: 'bond', tier: 'core', rs_rating: 40, dividend: { yield_pct: 4.8, freq: '季配', months: [3, 6, 9, 12] }, desc: '長天期公債溢價低 · 降息波段優選' },
  { code: '00720B', name: '元大投資級公司債', category: 'bond', tier: 'core', rs_rating: 42, dividend: { yield_pct: 5.8, freq: '季配', months: [1, 4, 7, 10] }, desc: 'BBB級以上投資級跨國企業債 · 5.8%高殖利率' },
  // 槓桿型 (保留供查詢)
  { code: '00631L', name: '元大台灣50正2', category: 'leverage', tier: 'core', rs_rating: 99, isLeverage: true },
  { code: '00670L', name: '富邦NASDAQ正2', category: 'leverage', tier: 'core', rs_rating: 60, isLeverage: true },
];

export const BENCHMARK_TW_STOCKS_DEF = [
  { code: '2330', name: '台積電', rs_rating: 92, eps: { growth_pct: 91.6, valid: true } },
  { code: '2454', name: '聯發科', rs_rating: 86, eps: { growth_pct: 35.0, valid: true } },
  { code: '2317', name: '鴻海',   rs_rating: 88, eps: { growth_pct: 28.5, valid: true } },
  { code: '2382', name: '廣達',   rs_rating: 84, eps: { growth_pct: 24.2, valid: true } },
  { code: '2603', name: '長榮',   rs_rating: 89, eps: { growth_pct: 155.0, valid: true } },
];

export const BENCHMARK_US_STOCKS_DEF = [
  { code: 'NVDA', name: 'NVIDIA 輝達', rs_rating: 95, eps: { growth_pct: 122.0, valid: true } },
  { code: 'AAPL', name: 'Apple 蘋果',   rs_rating: 82, eps: { growth_pct: 12.0, valid: true } },
  { code: 'MSFT', name: 'Microsoft 微軟', rs_rating: 83, eps: { growth_pct: 15.0, valid: true } },
  { code: 'GOOGL',name: 'Alphabet 谷歌', rs_rating: 84, eps: { growth_pct: 33.0, valid: true } },
  { code: 'AMD',  name: 'AMD 超微',     rs_rating: 85, eps: { growth_pct: 34.0, valid: true } },
  { code: 'AVGO', name: 'Broadcom 博通', rs_rating: 91, eps: { growth_pct: 47.0, valid: true } },
];

/**
 * 從 sessionStorage 尋找是否有 Screener 掃描過的原生完整豐富資料
 */
export function getEnrichedStockData(rawCode) {
  if (!rawCode) return null;
  const code = String(rawCode).trim().toUpperCase();
  const clean = code.replace(/\.TW(O)?$/i, '');

  try {
    const tw = JSON.parse(sessionStorage.getItem('screener_tw_data') || '{}');
    const matchTw = (tw.results || []).find(r => (r.code || '').toUpperCase() === clean);
    if (matchTw) return { ...matchTw, isTw: true, market_regime: tw.market_regime };

    const us = JSON.parse(sessionStorage.getItem('screener_us_data') || '{}');
    const matchUs = (us.results || []).find(r => (r.code || '').toUpperCase() === clean);
    if (matchUs) return { ...matchUs, isTw: false, market_regime: us.market_regime };
  } catch (_) {}

  // 靜態定義補備
  const twEtf = CORE_TW_ETFS_DEF.find(x => x.code === clean);
  if (twEtf) return { ...twEtf, isTw: true, isEtf: true };
  const twStock = BENCHMARK_TW_STOCKS_DEF.find(x => x.code === clean);
  if (twStock) return { ...twStock, isTw: true, isEtf: false };
  const usEtf = CORE_US_ETFS_DEF.find(x => x.code === clean);
  if (usEtf) return { ...usEtf, isTw: false, isEtf: true };
  const usStock = BENCHMARK_US_STOCKS_DEF.find(x => x.code === clean);
  if (usStock) return { ...usStock, isTw: false, isEtf: false };

  return null;
}

/**
 * 取得當前大盤架構
 */
export function getMarketRegime(isTw) {
  try {
    const key = isTw ? 'screener_tw_data' : 'screener_us_data';
    const cached = JSON.parse(sessionStorage.getItem(key) || '{}');
    if (cached.market_regime) return cached.market_regime;
  } catch (_) {}
  return { status: 'BULL_MILD', level: '高檔震盪', diff_ma50_pct: 0.5 };
}

/**
 * 多維度風報比評估
 */
export function evaluateRrrGrade(rrr, { isEtf, ma200Dist, belowSupport, isExtended, isSb, isPb, trendTemplate, rsRating, epsGrowth }) {
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
  if (!isPb && !isSb && (belowSupport || (ma200Dist != null && ma200Dist < -5))) {
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

/**
 * 核心統一五維度評估與作戰計畫計算器
 * 輸入：個股資料或 SEMA 資料物件（不管是 Screener 還是 Dashboard，皆由本函式產出）
 */
export function evaluateStockUnified(stockOrData, regimeOverride) {
  if (!stockOrData) return null;

  const code = (stockOrData.code || stockOrData.symbol || '').replace(/\.TW(O)?$/i, '');
  const enriched = getEnrichedStockData(code) || {};

  const price = stockOrData.price || stockOrData.sema_data?.price || enriched.price || 0;
  const changePct = stockOrData.changePct ?? stockOrData.sema_data?.changePct ?? enriched.changePct ?? 0;
  const sd = stockOrData.sema_data || stockOrData;
  const allSemas = sd.allSemas || sd.semas || [];

  const isTw = stockOrData.isTw ?? enriched.isTw ?? (/^\d+/.test(code) || (stockOrData.code || '').endsWith('.TW'));
  const isEtf = stockOrData.isEtf ?? enriched.isEtf ?? (
    /^(00\d{2,4}[LA]?)$/.test(code) ||
    ['TQQQ','SOXL','QLD','SSO','UPRO','NVDL','SMH','QQQ','SCHD','JEPI','JEPQ','VYM','DGRO','VOO','SPY'].includes(code)
  );

  const rsRating = stockOrData.rs_rating || enriched.rs_rating || (isEtf ? 75 : 60);
  const eps = stockOrData.eps || enriched.eps || null;
  const dividend = stockOrData.dividend || enriched.dividend || null;
  const chips = stockOrData.chips || enriched.chips || { it_consec_days: 0, it_net_lots_5d: 0, is_it_hot: false };
  const regime = regimeOverride || enriched.market_regime || getMarketRegime(isTw);

  // 均線與支撐/壓力分析
  const supports = allSemas.filter(s => s.value != null && s.value < price);
  const closestSupport = supports.length > 0
    ? supports.reduce((max, s) => (s.value > max.value ? s : max), supports[0])
    : null;
  const distS = closestSupport ? Number(((price - closestSupport.value) / price * 100).toFixed(2)) : (stockOrData.setup?.dist_support_pct ?? null);
  const pLine = closestSupport?.label || stockOrData.setup?.pullback_line || 'SEMA2';

  const resists = allSemas.filter(s => s.value != null && s.value >= price);
  const closestResist = resists.length > 0
    ? resists.reduce((min, s) => (s.value < min.value ? s : min), resists[0])
    : null;
  const dR = closestResist ? Number(((closestResist.value - price) / price * 100).toFixed(1)) : 999;

  const s5 = allSemas.find(s => s.label === 'SEMA5');
  const s8 = allSemas.find(s => s.label === 'SEMA8');
  const trendTemplate = Boolean(s5 && s8 && price > s5.value && s5.value > s8.value);
  const biasMa50 = s5 ? Number(((price - s5.value) / s5.value * 100).toFixed(1)) : (stockOrData.setup?.bias_ma50 ?? 0);
  const isExtended = biasMa50 >= 25.0;
  const ma200Dist = s8 ? Number(((price - s8.value) / s8.value * 100).toFixed(1)) : (stockOrData.ma200_dist ?? null);

  const vol45 = sd.vol45Ratio || 1.0;
  const wave = sd.waveState;
  const closePos = sd.closePos != null ? sd.closePos : 0.5;

  // 關鍵買點定義 (短線起漲 與 回測買點)
  const isSb = Boolean(
    stockOrData.setup?.is_short_bounce ?? (
      (rsRating >= 80 || isEtf) &&
      !isExtended &&
      ['SEMA1', 'SEMA2', 'SEMA3'].includes(pLine) &&
      distS != null && distS <= 3.0 &&
      (changePct == null || changePct >= -3.5) &&
      (vol45 <= 0.85 || ['C', 'D'].includes(wave)) &&
      closePos >= 0.50
    )
  );

  const isPb = Boolean(
    stockOrData.setup?.is_pullback_buy ?? (
      (rsRating >= 80 || isEtf) &&
      !isExtended &&
      ['SEMA1', 'SEMA2', 'SEMA3', 'SEMA4', 'SEMA5', 'SEMA6'].includes(pLine) &&
      distS != null && distS <= 3.5 &&
      (changePct == null || changePct >= -4.0)
    )
  );

  // 真正破線判斷：跌破 SEMA5 季線負乖離顯著或跌破年線，且下方無可靠支撐（不能把拉回測試 SEMA4/5/6 誤判為破線）
  const isBroken = Boolean(
    !isPb && !isSb && (
      (sd.belowSema3 && biasMa50 < -4.0 && (distS == null || distS > 5.0)) ||
      (ma200Dist != null && ma200Dist < -10.0) ||
      (sd.noSupport && sd.belowSema3)
    )
  );

  // ── 實戰作戰計畫 (Trade Plan) ──
  const tp = stockOrData.eval?.trade_plan || {};
  const buyMin = tp.buy_zone ? tp.buy_zone[0] : Number((price * 0.992).toFixed(price >= 50 ? 1 : 2));
  const buyMax = tp.buy_zone ? tp.buy_zone[1] : Number((price * 1.005).toFixed(price >= 50 ? 1 : 2));
  const stopLoss = tp.stop_loss ? tp.stop_loss : (closestSupport ? Number((closestSupport.value * 0.985).toFixed(price >= 50 ? 1 : 2)) : Number((price * 0.978).toFixed(price >= 50 ? 1 : 2)));
  const stopPct = tp.stop_pct ? tp.stop_pct : Number(((stopLoss - price) / (price || 1) * 100).toFixed(1));

  let targetPrice = tp.target_price;
  if (!targetPrice) {
    if (sd.prevHigh && sd.prevHigh.price > price) {
      targetPrice = Number((sd.prevHigh.price * 0.99).toFixed(price >= 50 ? 1 : 2));
    } else if (isSb) {
      targetPrice = Number((price * 1.055).toFixed(price >= 50 ? 1 : 2));
    } else if (isPb) {
      targetPrice = Number((price * 1.065).toFixed(price >= 50 ? 1 : 2));
    } else {
      targetPrice = Number((price * 1.045).toFixed(price >= 50 ? 1 : 2));
    }
  }
  const targetPct = tp.target_pct ? tp.target_pct : Number(((targetPrice - price) / (price || 1) * 100).toFixed(1));
  const rrr = tp.rrr ? tp.rrr : Number(Math.abs(targetPct / (stopPct || -1.5)).toFixed(1));

  // ── 統一徽章 (Badge) 與 核心理由 (Rationale) ──
  let badge = { text: '🟢 建議買進', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.12)', border: 'rgba(74, 222, 128, 0.4)' };
  let rationale = '';

  if (sd.clearOut || (sd.topMsg && String(sd.topMsg).startsWith('⚠'))) {
    badge = { text: '⚠ 出場訊號', color: '#f87171', bg: 'rgba(248, 113, 113, 0.14)', border: 'rgba(248, 113, 113, 0.35)' };
    rationale = `⚠ 爆天量或高檔急漲乖離過大 · 恐有轉折拉回風險，建議分批停利`;
  } else if (isBroken) {
    badge = { text: '🚨 破線警戒', color: '#f87171', bg: 'rgba(248, 113, 113, 0.14)', border: 'rgba(248, 113, 113, 0.35)' };
    rationale = `🚨 跌破重要均線支撐 · 短均轉壓反彈無力，建議嚴守停損或觀望待變`;
  } else if (isEtf) {
    if (ma200Dist != null && ma200Dist < 0) {
      badge = { text: '⚠️ 破年線觀望', color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)', border: 'rgba(248, 113, 113, 0.4)' };
      rationale = `⚠️ 股價跌破年線 (200MA ${ma200Dist}%) · 長期結構轉弱，建議暫停定期定額`;
    } else if ((distS != null && distS <= 2.2) || biasMa50 < 3.0) {
      badge = { text: '💎 便宜加碼點', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.15)', border: 'rgba(74, 222, 128, 0.4)' };
      const ma200Str = ma200Dist != null ? ` (距年線 ${ma200Dist > 0 ? '+' : ''}${ma200Dist}%)` : '';
      rationale = `💰 均線拉回特價甜甜價${ma200Str} · 建議把握加碼機會`;
    } else if (isExtended) {
      badge = { text: '⏸ 偏高暫停加碼', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.4)' };
      rationale = `⏸ 季線乖離過大 (+${biasMa50}%) · 追高風險高，維持定期定額勿大筆追高`;
    } else {
      badge = { text: '✓ 定期定額 (合理)', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)' };
      const ma200Str = ma200Dist != null ? ` (+${ma200Dist}%)` : '';
      rationale = `💰 站在年線之上${ma200Str} · 趨勢穩健向上，維持紀律定期定額`;
    }
  } else if (isSb) {
    badge = { text: '🔥 低點起漲', color: '#fb7185', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.45)' };
    rationale = `🔥 回測 ${pLine} 支撐守穩 (+${distS}%) · 45日量比 ${vol45}× 極致量縮 · 尾盤買盤承接`;
  } else if (isPb) {
    badge = { text: '🎯 回測買點', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.15)', border: 'rgba(74, 222, 128, 0.4)' };
    rationale = `🎯 回測 ${pLine} 支撐守穩 (+${distS}%) · 均線多頭排列架構穩健`;
  } else if (isExtended) {
    badge = { text: '🚨 乖離過大', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.4)' };
    rationale = `⏸ 季線正乖離過大 (+${biasMa50}%) · 追高風險高，等待拉回均線`;
  } else if (sd.isNewHigh60 || sd.seaWideOpen) {
    badge = { text: '🌊 創高多頭', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.35)' };
    rationale = `🌊 創近期新高且上方無壓力 · 多方順風推進，留意漲多乖離`;
  } else if (dR != null && dR < 3.5) {
    badge = { text: '⚠️ 逼近壓力', color: '#facc15', bg: 'rgba(250, 204, 21, 0.12)', border: 'rgba(250, 204, 21, 0.35)' };
    rationale = `⚠️ 距上方壓力僅剩 +${dR}% · 短線空間受限，避免追高`;
  } else {
    badge = { text: '⚪ 站穩多頭', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)', border: 'rgba(96, 165, 250, 0.35)' };
    rationale = `🌊 股價站穩短均多頭排列 · 距離下方支撐 +${distS ?? 2.0}% · 順勢續抱`;
  }

  // ── 五維度評估得分 (若已在 Screener 被 Python 算好，直接復用，保證數值 100% 相同) ──
  let dimensions = stockOrData.eval?.dimensions;
  let totalScore = stockOrData.eval?.total_score;
  let verdict = stockOrData.eval?.verdict;
  let verdictDesc = stockOrData.eval?.verdict_desc;

  if (!dimensions) {
    // 1. 大盤
    const regLevel = regime?.level || 'BULL_STRONG';
    const regDiff = regime?.diff_ma50_pct != null ? regime.diff_ma50_pct : 2.5;
    let mScore = 92, mLight = 'GREEN', mDesc = `大盤站穩季線 (${regDiff >= 0 ? '+' : ''}${regDiff}%) · 順風環境適合積極操作`;
    if (regLevel.includes('MILD') || regLevel.includes('震盪') || regLevel === 'CAUTION') {
      mScore = 75; mLight = 'YELLOW'; mDesc = `大盤高檔震盪整理 (季線 ${regDiff >= 0 ? '+' : ''}${regDiff}%) · 宜縮小部位嚴守紀律`;
    } else if (regLevel.includes('CHOPPY') || regLevel.includes('盤整')) {
      mScore = 62; mLight = 'YELLOW'; mDesc = `大盤震盪盤整 (季線 ${regDiff >= 0 ? '+' : ''}${regDiff}%) · 縮小部位並嚴格防守`;
    } else if (regLevel.includes('BEAR') || regLevel.includes('空頭') || regDiff < -3.0) {
      mScore = 38; mLight = 'RED'; mDesc = `大盤空頭破線 (跌破季線 ${regDiff}%) · 系統性風險高，建議保留現金`;
    }

    // 2. 價量型態
    let tScore = 80, tLight = 'GREEN', tDesc = rationale;
    if (isSb) {
      tScore = 95; tLight = 'GREEN';
    } else if (isPb) {
      tScore = 88; tLight = 'GREEN';
    } else if (isBroken) {
      tScore = 45; tLight = 'RED';
    } else if (isExtended) {
      tScore = 55; tLight = 'YELLOW';
    }

    // 3. 法人籌碼
    let cScore = 70, cLight = 'YELLOW', cDesc = `籌碼平穩維持常態`;
    if (isTw && !isEtf) {
      const itDays = chips?.it_consec_days || 0;
      const itLots = chips?.it_net_lots_5d || 0;
      if (itDays >= 5 || chips?.is_it_hot) {
        cScore = 94; cLight = 'GREEN'; cDesc = `投信連續買超 ${itDays} 天 (5日累計 ${itLots.toLocaleString()} 張) · 法人大戶積極認養`;
      } else if (itDays >= 3) {
        cScore = 85; cLight = 'GREEN'; cDesc = `投信連續買超 ${itDays} 天 · 籌碼集中沉澱`;
      } else if (itDays >= 1) {
        cScore = 75; cLight = 'GREEN'; cDesc = `投信小幅買超偏多`;
      } else if (rsRating >= 85) {
        cScore = 82; cLight = 'GREEN'; cDesc = `RS 評級 ${rsRating} · 動能強勁，資金青睞`;
      }
    } else {
      if (rsRating >= 88) {
        cScore = 92; cLight = 'GREEN'; cDesc = `RS 評級 ${rsRating} · 機構高度認養之市場頂尖領頭羊`;
      } else if (rsRating >= 80) {
        cScore = 84; cLight = 'GREEN'; cDesc = `RS 評級 ${rsRating} · 動能超越全市場 80% 標的`;
      } else {
        cScore = 72; cLight = 'YELLOW'; cDesc = `RS 評級 ${rsRating} · 動能平穩，維持平均水平`;
      }
    }

    // 4. 基本動能
    const gp = eps?.growth_pct;
    const yp = dividend?.yield_pct;
    let fScore = 75, fLight = 'GREEN', fDesc = `營運維持常態水準`;
    if (gp != null && gp >= 25) {
      fScore = 90; fLight = 'GREEN'; fDesc = `EPS 年增率 +${gp.toFixed(1)}% (高成長動能) · 獲利加速爆發`;
    } else if (gp != null && gp > 0) {
      fScore = 80; fLight = 'GREEN'; fDesc = `EPS 年增率 +${gp.toFixed(1)}% · 基本面維持正成長`;
    } else if (yp != null && yp >= 4.5) {
      fScore = 86; fLight = 'GREEN'; fDesc = `預估年化殖利率 ${yp.toFixed(1)}% · 高股息防禦下檔保護`;
    } else if (isEtf) {
      fScore = 84; fLight = 'GREEN'; fDesc = `指數型商品 · 分散單一持股營運風險`;
    }

    // 5. 風報比精算
    let rScore = 82, rLight = 'GREEN', rDesc = `風報比 ${rrr}:1【合理試單】· 承擔 ${stopPct}% 風險搏取 +${targetPct}%`;
    if (rrr >= 2.5) {
      rScore = 94; rLight = 'GREEN'; rDesc = `風報比 ${rrr}:1【短波極佳】· 承擔 ${stopPct}% 風險搏取 +${targetPct}%`;
    } else if (isBroken) {
      rScore = 48; rLight = 'RED'; rDesc = `風報比 ${rrr}:1【破線偏弱】· 跌破重要支撐，不宜貿然抄底`;
    } else if (isExtended) {
      rScore = 58; rLight = 'YELLOW'; rDesc = `風報比 ${rrr}:1【乖離過大】· 脫離均線過遠，耐心等拉回`;
    } else if (rrr < 1.8) {
      rScore = 65; rLight = 'YELLOW'; rDesc = `風報比 ${rrr}:1【空間受限】· 建議掛單貼近支撐位`;
    }

    const lights = [mLight, tLight, cLight, fLight, rLight];
    const greenCount = lights.filter(l => l === 'GREEN').length;
    totalScore = Math.round(mScore * 0.2 + tScore * 0.25 + cScore * 0.2 + fScore * 0.15 + rScore * 0.2);

    if (greenCount >= 4 && totalScore >= 78) {
      verdict = 'BUY'; verdictDesc = `建議分批買進 (${greenCount}/5 綠燈 · 評分 ${totalScore})`;
    } else if (greenCount >= 3 && totalScore >= 68) {
      verdict = 'WAIT'; verdictDesc = `逢回分批布局 (${greenCount}/5 綠燈 · 評分 ${totalScore})`;
    } else {
      verdict = 'AVOID'; verdictDesc = `暫先觀望待變 (${greenCount}/5 綠燈 · 評分 ${totalScore})`;
    }

    dimensions = {
      market:      { name: '大盤環境', score: mScore, light: mLight, summary: mDesc },
      technical:   { name: '價量型態', score: tScore, light: tLight, summary: tDesc },
      chips:       { name: '法人籌碼', score: cScore, light: cLight, summary: cDesc },
      fundamental: { name: '基本動能', score: fScore, light: fLight, summary: fDesc },
      risk_reward: { name: '風報比精算', score: rScore, light: rLight, summary: rDesc },
    };
  }

  const greenCount = Object.values(dimensions).filter(d => d.light === 'GREEN').length;

  const rrrGrade = evaluateRrrGrade(rrr, {
    isEtf,
    ma200Dist,
    belowSupport: isBroken,
    isExtended,
    isSb,
    isPb,
    trendTemplate,
    rsRating,
    epsGrowth: eps?.growth_pct,
  });

  const tradePlan = {
    buy_zone: [buyMin, buyMax],
    buyZone: [buyMin, buyMax],
    stop_loss: stopLoss,
    stopLoss: stopLoss,
    stop_pct: stopPct,
    stopPct: stopPct,
    target_price: targetPrice,
    targetPrice: targetPrice,
    target_pct: targetPct,
    targetPct: targetPct,
    rrr,
  };

  return {
    code,
    name: stockOrData.name || enriched.name || code,
    price,
    changePct,
    isTw,
    isEtf,
    rsRating,
    eps,
    dividend,
    chips,
    badge,
    rationale,
    pLine,
    distS,
    dR,
    ma200Dist,
    isExtended,
    isSb,
    isPb,
    isBroken,
    trendTemplate,
    tradePlan,
    rrrGrade,
    dimensions,
    totalScore,
    greenCount,
    eval: {
      total_score: totalScore,
      passed_lights: greenCount,
      verdict: verdict || 'WAIT',
      verdict_desc: verdictDesc || `綜合評分 ${totalScore}`,
      dimensions,
      trade_plan: tradePlan,
    },
  };
}
