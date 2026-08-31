import React from 'react';
import ReactDOM from 'react-dom/client';

// 參考版本: 生日快樂版 v2.03 (sunny_app_reference.html) — 含 CDP 樞紐點、休市日假K棒剔除
const { useState, useEffect, useRef, useCallback } = React;
const SEMA_API = 'https://stock-tools.adelitwo.workers.dev/sema';

export const r2 = n => Math.round(n * 100) / 100;

const SEMA_COLORS = {
  SEMA1:'#ff4d4d', SEMA2:'#ff8c42', SEMA3:'#ffb627', SEMA4:'#e8d44d', SEMA5:'#7ed957',
  SEMA6:'#2ecc71', SEMA7:'#1abc9c', SEMA8:'#2ac0d4', SEMA9:'#3498db', SEMA10:'#4d7cff',
  SEMA11:'#6c5ce7', SEMA12:'#9b59b6', SEMA13:'#c44dca', SEMA14:'#e84393', SEMA15:'#d63a6a',
};
const KEY_SEMA_SET = new Set(['SEMA3','SEMA5','SEMA8','SEMA11','SEMA14']);
const semaColor = (label, isResist) => SEMA_COLORS[label] || (isResist ? '#b83838' : '#2c8050');

const breakoutSellAdvice = data => {
  if (!data || !data.isNewHigh60) return null;
  const iv = data.intraday;
  let mag5 = null, wmag = null, volSrc = null;
  if (iv && iv.r5 != null) {
    mag5 = iv.r5;
    const r15 = iv.r15 != null ? iv.r15 : iv.r5;
    const r30 = iv.r30 != null ? iv.r30 : r15;
    wmag = iv.r5 * 0.6 + r15 * 0.25 + r30 * 0.15;
    volSrc = 'intraday';
  } else if (iv && (iv.r15 != null || iv.r30 != null)) {
    mag5 = iv.r15 != null ? iv.r15 : iv.r30;
    wmag = mag5;
    volSrc = 'intraday';
  } else if (data.vol45Ratio != null) {
    mag5 = data.vol45Ratio;
    wmag = data.vol45Ratio;
    volSrc = 'daily';
  }
  const liveTag = '';
  let volTier;
  if (mag5 == null) volTier = 'unknown';
  else if (volSrc === 'daily') {
    if (mag5 >= 3) volTier = 'surge'; else if (mag5 >= 2) volTier = 'up'; else if (mag5 >= 0.7) volTier = 'flat'; else volTier = 'down';
  } else {
    if (mag5 >= 2) volTier = 'surge'; else if (mag5 >= 1.5) volTier = 'up'; else if (mag5 >= 0.7) volTier = 'flat'; else volTier = 'down';
  }
  const dayBlowoff = (volSrc === 'daily' && mag5 != null && mag5 >= 3) || (iv && iv.r30 != null && iv.r30 >= 5);
  const closeLow = data.closePos != null && data.closePos <= 0.23;
  if (volTier === 'surge' && dayBlowoff && closeLow) {
    return { level:'top', tier:'full', volTier, mag5, wmag, volSrc, liveTag,
      reason:'爆天量又收長上影、收很低 → 多殺多、可能見頂，這不是回測短均能交代的，恐須休息一陣子，建議全數停利' };
  }
  let tier, reason;
  if (volTier === 'surge') {
    tier = 'partial';
    reason = volSrc === 'daily' ? '量爆增（今日量≥VOL45×3），多方力道強、續攻機會較大；但創高日常收長上影，建議分批停利' : '開盤量爆增（主力企圖強），續攻機會較大；但創高日人人想停利、常收長上影，建議分批停利';
  } else if (volTier === 'up') {
    tier = 'partial';
    reason = volSrc === 'daily' ? '量增（今日量≥VOL45×2），價漲量增是好事；但創高日常收長上影，建議分批停利' : '開盤量明顯放大，多方有力；創高日常收長上影，建議分批停利';
  } else if (volTier === 'flat') {
    tier = 'partial';
    reason = volSrc === 'daily' ? '量能普通（未達量增門檻），力道一般；創高日宜分批停利' : '開盤量普通，力道一般；創新高宜分批停利';
  } else if (volTier === 'down') {
    tier = 'partial';
    reason = volSrc === 'daily' ? '量縮創高（可能跳空惜售=強勢、或主力暫歇=觀望），需觀察隔日量能；建議分批停利留餘地' : '開盤量縮創高（可能跳空惜售或主力暫歇），需觀察盤中量能；建議分批停利';
  } else {
    tier = 'partial';
    reason = '創新高，創高日常因人人停利收長上影，建議分批停利';
  }
  return { level:'normal', tier, reason, volTier, mag5, wmag, volSrc, liveTag };
};

const breakdownAdvice = (data, redLight, nextLabel, nearRisingBigBottom, nearResistPct, s2s3Down3) => {
  if (!data || !data.belowSema3) return null;
  const bothDown = data.s1Down && data.s2Down;
  if (redLight) {
    const lbl = nextLabel || '下一條支撐';
    return { strong:false, brake:true, msg:`連續下跌但已逼近${lbl} · 留意反彈`,
      reason:`雖連續跌破<支撐3>，但現價已貼近${lbl}強支撐區，此處易有反彈、不宜追殺低點；先觀察${lbl}守不守得住，爆量跌破再議。` };
  }
  if (bothDown && nearRisingBigBottom) {
    return { strong:false, msg:`已跌${data.breakDays}天 · 接近長均大底，留意是否止穩`,
      reason:'雖短均下彎，但已接近上揚的長天期均線（長線大底支撐）；此處不宜追殺低點，先觀察是否止穩、有無帶量轉強。' };
  }
  if (bothDown) {
    if (data.breakDays > 3) {
      return { strong:true, msg:`收盤已跌破<支撐3>超過3天 · 若有反彈應減碼`,
        reason:'連3天跌破<支撐3>即為出場訊號，現已逾期；短均下彎、反彈易被壓回，不宜追殺低點，宜趁反彈分批減碼，待站回<支撐3>再議。' };
    }
    return { strong:true, msg:`收盤連續${data.breakDays}天跌破<支撐3> · 建議反彈減碼或停利`,
      reason:'支撐1已下彎轉為壓力1，支撐2已下彎轉為壓力2，反彈時易被壓回；若非帶量上攻，否則建議於反彈時減碼或停利' };
  }
  if (s2s3Down3) {
    const lbl = nextLabel || '下方支撐';
    return { strong:false, msg:`短均皆已下彎成壓力 · 觀察${lbl}是否能止跌`,
      reason:`<壓力2>、<壓力3>等短均接連下彎、壓在現價上方，反彈無力；觀察${lbl}(現價下方第一條向上支撐)能否止跌橫盤，爆量跌破則趨勢續弱。` };
  }
  const REBOUND_PCT = 6;
  if (!data.s1Down && nearResistPct != null && nearResistPct <= REBOUND_PCT) {
    return { strong:true, msg:`破底後反彈至壓力區 · 反彈減碼`,
      reason:'已跌破<支撐3>、但短均已勾上反彈，現價反彈至接近上方壓力；反彈如煙火、易被壓回，宜趁接近壓力分批減碼，不宜期待一路上攻。' };
  }
  return { strong:false, msg:data.breakDays > 5 ? `已連續多日跌破<支撐3> · 留意轉弱` : `收盤連續${data.breakDays}天跌破<支撐3> · 留意轉弱`,
    reason:'已連續跌破短中均線，趨勢轉弱，宜留意；若短均接連下彎、反彈無量，宜考慮出場' };
};

export function computeGaugeMessages(data) {
  const { price, semas } = data;
  const allSemas = data.allSemas || semas;
  const semaSeq = lbl => { const m = /SEMA(\d+)/.exec(lbl || ''); return m ? parseInt(m[1], 10) : 0; };
  const resist  = semas.filter(s => s.value >= price).sort((a,b) => a.value - b.value);
  const support = semas.filter(s => s.value <  price).sort((a,b) => b.value - a.value);
  const isRising = s => { const r=(s.recent||[]).filter(x=>x!=null&&!isNaN(x)); if(r.length<2)return false; return r[r.length-1]>r[r.length-2]; };
  const tomorrowOf = s => s && s.kdc != null && s.period ? r2(s.value+(price-s.kdc)/s.period) : s ? s.value : null;
  const crossesPrice = s => { const tv=tomorrowOf(s); return (s.value>=price)!==(tv>=price); };
  const hasBigWall  = !!(data.prevHigh && data.prevHigh.price > price && (data.prevHigh.level == null || data.prevHigh.level >= 1));
  const buySemas = data.isBearStock ? allSemas.filter(s => semaSeq(s.label) <= 9) : allSemas;
  const computeDynamicResist = () => {
    const FAIL_PCT = 0.02;
    const pv = data.recentPV;
    if (!pv || pv.length < 2 || !allSemas.length) return null;
    const today = pv[pv.length-1], yday = pv[pv.length-2];
    const priceUp = today.close > yday.close, volDown = today.lots < yday.lots;
    const upDownSemas = allSemas.filter(s => s.value > price && !isRising(s)).sort((a,b) => a.value - b.value);
    if (!upDownSemas.length) return null;
    const first = upDownSemas[0];
    if (priceUp && !volDown) {
      const distPct = (first.value - price) / price;
      if (distPct <= FAIL_PCT) {
        const second = upDownSemas.find(s => (s.value - first.value) / first.value > 0.02);
        return second || first;
      }
    }
    return first;
  };
  const computeDynamicSupport = () => {
    const FAIL_PCT = 0.02;
    const pv = data.recentPV;
    if (!pv || pv.length < 2 || !allSemas.length) return null;
    const today = pv[pv.length-1], yday = pv[pv.length-2];
    const priceDown = today.close < yday.close, volDown = today.lots < yday.lots;
    const downUpSemas = buySemas.filter(s => s.value < price && isRising(s)).sort((a,b) => b.value - a.value);
    if (!downUpSemas.length) return null;
    const first = downUpSemas[0];
    if (priceDown && !volDown) {
      const distPct = (price - first.value) / price;
      if (distPct <= FAIL_PCT) {
        const second = downUpSemas.find(s => (first.value - s.value) / first.value > 0.02);
        return second || first;
      }
    }
    return first;
  };
  const dynamicResist  = computeDynamicResist();
  const dynamicSupport = computeDynamicSupport();
  const sellTarget  = dynamicResist && !crossesPrice(dynamicResist) ? dynamicResist : resist.find(s => !crossesPrice(s) && !isRising(s));
  const buyPool     = hasBigWall ? support.slice(1) : support;
  const _dynOK = dynamicSupport && dynamicSupport.value < price;
  const buyTargetUp = (_dynOK ? dynamicSupport : null) || buyPool.find(s => s.value < price && isRising(s) && !crossesPrice(s)) || null;
  const backupSupport = buyTargetUp
    ? buyPool.filter(s => s.label !== buyTargetUp.label && s.value < buyTargetUp.value && isRising(s) && !crossesPrice(s))
              .sort((a, b) => b.value - a.value)[0] || null
    : null;
  const gapAbovePct = s => (s.value-price)/price;
  const downCurveWall = resist.find(s => !isRising(s) && gapAbovePct(s)>=0.003 && gapAbovePct(s)<=0.015) || null;
  const semaNum = label => label.replace('SEMA','');
  const distSemaR    = sellTarget    ? Math.abs((sellTarget.value-price)/price)*100    : 999;
  const distPrevHigh = data.prevHigh && data.prevHigh.price > price ? Math.abs((data.prevHigh.price-price)/price)*100 : 999;
  const distDownCurve= downCurveWall ? Math.abs((downCurveWall.value-price)/price)*100 : 999;
  const dR = Math.min(distSemaR, distPrevHigh, distDownCurve);
  const dS = buyTargetUp ? Math.abs((price-buyTargetUp.value)/price)*100 : 999;
  const noResist    = !allSemas.some(s=>s.value>=price);
  const seaWideOpen = noResist && data.steadyAbove;
  const justRecovered = noResist && !data.steadyAbove && data.aboveDays > 0;
  const noSupport   = !allSemas.some(s=>s.value<price);
  const fmtP = v => v==null?'':v.toLocaleString('en-US',{minimumFractionDigits:v<100?1:0,maximumFractionDigits:v<100?1:0});
  const fmtDist = tv => { if(tv==null)return''; const d=price-tv,dAbs=Math.abs(d),pct=Math.abs(d/price)*100; return `預估價差為 ${dAbs.toFixed(dAbs<50?1:0)} 元 (約${pct.toFixed(1)==='-0.0'?'0.0':pct.toFixed(1)}%)`; };
  const sellTomorrow = sellTarget  ? tomorrowOf(sellTarget)  : null;
  const buyTomorrow  = buyTargetUp ? tomorrowOf(buyTargetUp) : null;
  const dREst = sellTarget  ? Math.abs((sellTomorrow-price)/price)*100 : 999;
  const dSEst = buyTargetUp ? Math.abs((price-buyTomorrow)/price)*100  : 999;
  const nearestDistEst = Math.min(dREst,dSEst), towardResistEst = dREst < dSEst;
  const brkAdvice   = breakoutSellAdvice(data);
  const nearSupport = !towardResistEst && nearestDistEst <= 5;
  const redLight    = nearSupport;
  const nextSupLabel = buyTargetUp ? `<支撐${semaNum(buyTargetUp.label)}>` : null;
  const BIG_BRO = new Set(['SEMA11']);
  const nearRisingBigBottom = allSemas.some(s=>BIG_BRO.has(s.label)&&s.value<price&&(price-s.value)/price*100<=5&&isRising(s));
  const nearResistPct = resist.length ? (resist[0].value-price)/price*100 : null;
  const _s2o = allSemas.find(s=>s.label==='SEMA2'), _s3o = allSemas.find(s=>s.label==='SEMA3');
  const _down3d = obj => { const r=obj?(obj.recent||[]).filter(x=>x!=null&&!isNaN(x)):[]; return r.length>=3&&r[r.length-1]<r[r.length-3]; };
  const s2s3Down3 = _down3d(_s2o) && _down3d(_s3o);
  const bdAdvice    = breakdownAdvice(data, redLight, nextSupLabel, nearRisingBigBottom, nearResistPct, s2s3Down3);
  const sema1Obj  = allSemas.find(s=>s.label==='SEMA1');
  const sema3Obj  = allSemas.find(s=>s.label==='SEMA3');
  const sema8Obj  = allSemas.find(s=>s.label==='SEMA8');
  const bias17    = sema3Obj ? (price-sema3Obj.value)/sema3Obj.value*100 : 0;
  const sema8Down = sema8Obj ? !isRising(sema8Obj) : false;
  const bigBroAbove = allSemas.filter(s=>BIG_BRO.has(s.label)&&s.value>price).length;
  const clearOut    = bias17 > 10 && sema8Down && bigBroAbove >= 1;
  const clearOutMsg = clearOut ? '上方壓力沉重 · 建議全部出清' : null;
  const clearOutSub = clearOut ? `急漲未回測、乖離過大（${bias17.toFixed(1)}%），多空線仍下彎，頭上還有${bigBroAbove}條長均重壓；此為噴出反彈非真回升，宜全部出清。` : null;
  const ph     = data.prevHigh;
  const phLots = ph ? (data.isTw ? ph.lots : ph.lots * 1000).toLocaleString('en-US') : '';
  const phUnit = data.isTw ? '張' : '股';
  const phLevel = ph ? (ph.level == null ? 1 : ph.level) : 1;
  const phRiskWord   = phLevel === 3 ? '極高' : phLevel === 2 ? '較高' : '偏高';
  const phActionWord = phLevel === 3 ? '全數停利' : phLevel === 2 ? '半數停利' : '分批停利';
  const prevHighSell     = ph ? `前高壓力區段約為 ${fmtP(ph.price)} (共約${phLots}${phUnit})，建議可考慮分批停利` : null;
  const dcwLabel         = downCurveWall ? `<壓力${semaNum(downCurveWall.label)}>` : null;
  const downCurveSell    = downCurveWall ? `${dcwLabel}下彎轉壓（${fmtP(downCurveWall.value)}）· 易被巴頭，建議分批停利${prevHighSell?`；另${prevHighSell.replace('，建議可考慮分批停利','需留意')}`:''}` : null;
  const prevHighSellFull = ph && phLevel >= 1 ? `前高壓力區段約為 ${fmtP(ph.price)} (共約${phLots}${phUnit})，此價位風險${phRiskWord}，少賺總比賠錢好，建議${phActionWord}，不要貪！` : null;
  const prevHighLight    = ph && phLevel === 0 ? `上方${fmtP(ph.price)}有約${phLots}${phUnit}套牢，提醒留意(不算大魔王)` : null;
  const sellDistEst  = sellTarget ? sellTomorrow-price : null;
  const sellTargetMsg = sellTarget ? `預估停利價為 ${fmtP(sellTomorrow)}，距停利價還有 ${sellDistEst.toFixed(sellDistEst<50?1:0)} 元 (約${dREst.toFixed(1)==='-0.0'?'0.0':dREst.toFixed(1)}%)` : null;
  const newHighMsg   = brkAdvice && brkAdvice.level!=='top' ? (brkAdvice.tier==='full'?`⚠ ${brkAdvice.reason}${brkAdvice.liveTag}`:`股價已創近期新高 · 多少要賣一些，建議分批停利${brkAdvice.liveTag}`) : null;
  const lesserSells  = [sellTargetMsg, prevHighLight, downCurveSell, newHighMsg].filter(Boolean).join('；') || null;
  // 高檔轉弱訊號
  const offHighPct = data.high60 && data.high60 > 0 ? (data.high60 - price) / data.high60 * 100 : 0;
  const _s1r = sema1Obj ? (sema1Obj.recent||[]).filter(x=>x!=null&&!isNaN(x)) : [];
  const _s1peaked = _s1r.length>=3 && _s1r[_s1r.length-2]>=_s1r[_s1r.length-1] && _s1r[_s1r.length-2]>=_s1r[_s1r.length-3];
  const _s1down3  = _s1r.length>=3 && _s1r[_s1r.length-1]<_s1r[_s1r.length-3];
  const sema1Down = _s1peaked || _s1down3;
  const sema1Val  = sema1Obj ? sema1Obj.value : null;
  const closeBelowSema1 = sema1Down && sema1Val != null ? price < sema1Val : false;
  const headTurnSell = sema1Down && closeBelowSema1 && data.headPriceDown13
    ? `高檔做頭轉弱 · 收盤跌破下彎的<壓力1>(短均轉壓)，近13天量價背離${data.divergePct13!=null?data.divergePct13:'—'}%，反彈無力，建議反彈時停利或減碼`
    : null;
  const _ss3Rising = sema3Obj ? isRising(sema3Obj) : false;
  const reboundUnderPressure = sema3Obj && price > sema3Obj.value && _ss3Rising && sema1Down && sema1Val!=null && price < sema1Val && offHighPct >= 8
    ? `收盤已守住向上的<支撐3> · <壓力1> 已下彎、建議反彈至<壓力1>時應減碼`
    : null;
  const anyShortDown = data.s1Down || data.s2Down || (sema3Obj ? !isRising(sema3Obj) : false);
  const earlyWeakness = !data.belowSema3 && data.breakDays >= 1 && data.breakDays <= 2 && anyShortDown && offHighPct >= 8
    ? `高檔轉弱 · 已跌破<支撐3>，短均轉弱、建議反彈時應停利或減碼`
    : null;
  let earlyPullback = null;
  const _pv = data.recentPV;
  if (!data.belowSema3 && data.breakDays === 0 && offHighPct >= 8 && data.s1Down && _pv && _pv.length >= 2) {
    const _td=_pv[_pv.length-1], _yd=_pv[_pv.length-2];
    if (_td.close < _yd.close && _td.lots > _yd.lots) {
      const _below = allSemas.filter(s=>s.value<price).sort((a,b)=>b.value-a.value);
      const _nowSup = _below[0] ? `<支撐${semaNum(_below[0].label)}>` : '<支撐>';
      earlyPullback = `回測${_nowSup} 價跌量增，高檔恐轉弱，留意後續是否量縮止跌，否則應及早停利或減碼。`;
    }
  }
  const topMsg =
    clearOut                   ? `⚠ ${clearOutMsg}` :
    bdAdvice                   ? `${bdAdvice.strong?'⚠ ':''}${bdAdvice.msg}` :
    brkAdvice?.level==='top'   ? `⚠ 爆天量見頂訊號 · 建議全數停利${brkAdvice.liveTag}` :
    prevHighSellFull           ? prevHighSellFull :
    headTurnSell               ? headTurnSell :
    reboundUnderPressure       ? reboundUnderPressure :
    earlyWeakness              ? earlyWeakness :
    earlyPullback              ? earlyPullback :
    sellTarget                 ? sellTargetMsg :
    downCurveSell              ? downCurveSell :
    newHighMsg                 ? newHighMsg :
    seaWideOpen                ? '上方已無壓力，但仍需注意乖離風險！' :
    data.aboveDays===1         ? '今日突破<壓力3> · <壓力3>轉<支撐3>，連續3日後才能確認支撐有效' :
    data.aboveDays <= 3        ? `突破<壓力3>後第${data.aboveDays}天 · 觀察<支撐3>是否有效` :
    data.down3High             ? `連續下跌，上方無有效壓力(僅向上均線) · 留意 <支撐3>反彈力道` :
    `上方無有效壓力(僅向上均線) · 多頭續抱但留意漲多乖離風險`;
  const _topSubBase =
    clearOut                   ? clearOutSub :
    bdAdvice                   ? bdAdvice.reason :
    brkAdvice?.level==='top'   ? brkAdvice.reason :
    prevHighSellFull           ? lesserSells :
    [prevHighLight, brkAdvice ? brkAdvice.reason : null, justRecovered ? '壓力一旦突破會轉為支撐；需觀察3天確認<支撐3>是否守得住，站穩才算海闊天空（防假突破真拉回）' : null].filter(Boolean).join('；') || null;
  const topSubMsg = [_topSubBase, data.fibMsg].filter(Boolean).join('；') || null;
  const backupTomorrow = backupSupport ? tomorrowOf(backupSupport) : null;
  let botMsg;
  if (buyTargetUp && backupTomorrow != null) {
    botMsg = `預估參考價為 ${fmtP(buyTomorrow)}，${fmtDist(buyTomorrow)}，可小量跟進；若量縮回測，可酌量加碼。後備參考價為 ${fmtP(backupTomorrow)}，${fmtDist(backupTomorrow)}`;
  } else if (buyTargetUp) {
    botMsg = `預估參考價為 ${fmtP(buyTomorrow)}，${fmtDist(buyTomorrow)}，可小量跟進；若量縮回測，可酌量加碼`;
  } else if (noSupport) { botMsg = '下方無支撐 · 留意風險';
  } else if (support.length > 0) { botMsg = '下方支撐均下彎 · 暫無可靠參考價';
  } else { botMsg = '下方支撐暫不在畫面範圍 · 接近時自動顯示'; }
  const _baseSubMsg = (nearSupport && buyTargetUp) ? '可小量試單，若隨後持續補量代表買盤進場、可續抱；無量則別追、爆量跌破則出。' : null;
  const botSubMsg = data.nearHighMsg ? data.nearHighMsg : (_baseSubMsg || null);
  const topTextColor = topMsg === prevHighSellFull ? (phLevel === 3 ? '#ff6b6b' : phLevel === 2 ? '#f5c451' : '#8fd9a8') : '#b8e8c8';
  return { topMsg, topSubMsg, botMsg, botSubMsg, topTextColor, dR, dS };
}

function computeBallColor(data) {
  const { price, semas } = data;
  const allSemas = data.allSemas || semas;
  const resist  = semas.filter(s=>s.value>=price).sort((a,b)=>a.value-b.value);
  const support = semas.filter(s=>s.value<price).sort((a,b)=>b.value-a.value);
  const isRising = s => { const r=(s.recent||[]).filter(x=>x!=null&&!isNaN(x)); return r.length>=2&&r[r.length-1]>r[r.length-2]; };
  const tomorrowOf = s => s&&s.kdc!=null&&s.period ? r2(s.value+(price-s.kdc)/s.period) : s ? s.value : null;
  const crossesPrice = s => { const tv=tomorrowOf(s); return (s.value>=price)!==(tv>=price); };
  const hasBigWall = !!(data.prevHigh&&data.prevHigh.price>price&&(data.prevHigh.level==null||data.prevHigh.level>=1));
  const buySemas = data.isBearStock ? allSemas.filter(s=>{const m=/SEMA(\d+)/.exec(s.label||'');return m?parseInt(m[1],10)<=9:false;}) : allSemas;
  const _computeDynResist = () => {
    const pv=data.recentPV; if(!pv||pv.length<2||!allSemas.length)return null;
    const today=pv[pv.length-1],yday=pv[pv.length-2];
    const upDownSemas=allSemas.filter(s=>s.value>price&&!isRising(s)).sort((a,b)=>a.value-b.value);
    if(!upDownSemas.length)return null;
    const first=upDownSemas[0];
    if(today.close>yday.close&&!(today.lots<yday.lots)){
      if((first.value-price)/price<=0.02){const second=upDownSemas.find(s=>(s.value-first.value)/first.value>0.02);return second||first;}
    }
    return first;
  };
  const _computeDynSupport = () => {
    const pv=data.recentPV; if(!pv||pv.length<2||!allSemas.length)return null;
    const today=pv[pv.length-1],yday=pv[pv.length-2];
    const downUpSemas=buySemas.filter(s=>s.value<price&&isRising(s)).sort((a,b)=>b.value-a.value);
    if(!downUpSemas.length)return null;
    const first=downUpSemas[0];
    if(today.close<yday.close&&!(today.lots<yday.lots)){
      if((price-first.value)/price<=0.02){const second=downUpSemas.find(s=>(first.value-s.value)/first.value>0.02);return second||first;}
    }
    return first;
  };
  const _dynResist  = _computeDynResist();
  const _dynSupport = _computeDynSupport();
  const sellTarget = _dynResist&&!crossesPrice(_dynResist) ? _dynResist : resist.find(s=>!crossesPrice(s)&&!isRising(s));
  const buyPool = hasBigWall ? support.slice(1) : support;
  const _dynOK = _dynSupport&&_dynSupport.value<price;
  const buyTargetUp = (_dynOK?_dynSupport:null)||buyPool.find(s=>s.value<price&&isRising(s)&&!crossesPrice(s))||null;
  const gapAbovePct = s=>(s.value-price)/price;
  const downCurveWall = resist.find(s=>!isRising(s)&&gapAbovePct(s)>=0.003&&gapAbovePct(s)<=0.015)||null;
  const distSemaR    = sellTarget     ? Math.abs((sellTarget.value-price)/price)*100    : 999;
  const distPrevHigh = data.prevHigh&&data.prevHigh.price>price ? Math.abs((data.prevHigh.price-price)/price)*100 : 999;
  const distDownCurve= downCurveWall  ? Math.abs((downCurveWall.value-price)/price)*100 : 999;
  const dR = Math.min(distSemaR, distPrevHigh, distDownCurve);
  const dS = buyTargetUp ? Math.abs((price-buyTargetUp.value)/price)*100 : 999;
  const nearestDist = Math.min(dR,dS), towardResist = dR<dS;
  let ballColor, glowColor;
  if (nearestDist>10) { ballColor='#3d9bd4'; glowColor='rgba(70,150,210,0.4)'; }
  else {
    const t=Math.max(0,Math.min(1,(10-nearestDist)/10));
    if (towardResist) {
      ballColor=`rgb(${Math.round(70-t*20)},${Math.round(185+t*25)},${Math.round(115-t*15)})`;
      glowColor=`rgba(60,200,110,${0.35+t*0.4})`;
    } else {
      ballColor=`rgb(${Math.round(210+t*20)},${Math.round(80-t*25)},${Math.round(80-t*25)})`;
      glowColor=`rgba(220,75,75,${0.35+t*0.4})`;
    }
  }
  const blinkDur = nearestDist<=1?0.5:nearestDist<=3?1:nearestDist<=5?2:0;
  return { ballColor, glowColor, blinkDur, sellTarget, buyTargetUp };
}

export function WaterGauge({ data, gaugeW: W = 120 }) {
  const H       = Math.round(W * 3.125);
  const LEAD_W  = W * 2;
  const xL      = Math.round(W * 0.1);
  const xR      = W - xL;
  const bandH   = 8;
  const dotR    = Math.max(2, W * 0.021);
  const pFontLg = Math.max(15, Math.round(W * 0.15));
  const labelFont = 12;
  const VIS = 17;

  const { price, semas } = data;
  const allSemas = data.allSemas || semas;

  const yVals = [price];
  if (data.yHi17 != null) yVals.push(data.yHi17);
  if (data.yLo17 != null) yVals.push(data.yLo17);
  semas.forEach(s => {
    const r = (s.recent||[]).slice(-VIS).filter(v => v != null && !isNaN(v));
    (r.length ? r : [s.value]).forEach(v => yVals.push(v));
  });
  const maxV = Math.max(...yVals), minV = Math.min(...yVals);
  const span = (maxV-minV) || price*0.1;
  const padV = span * 0.06;
  const top = maxV + padV, bottom = minV - padV, range = top - bottom;
  const toY = v => ((top-v)/range)*(H-24)+12;
  const toYClamped = v => Math.max(8, Math.min(H-8, toY(v)));

  const resist  = semas.filter(s=>s.value>=price).sort((a,b)=>a.value-b.value);
  const support = semas.filter(s=>s.value<price).sort((a,b)=>b.value-a.value);

  const isRising = s => {
    const r = (s.recent||[]).filter(x=>x!=null&&!isNaN(x));
    if (r.length < 2) return false;
    return r[r.length-1] > r[r.length-2];
  };

  const tomorrowOf = s => s && s.kdc != null && s.period ? r2(s.value + (price-s.kdc)/s.period) : s ? s.value : null;
  const crossesPrice = s => { const tv = tomorrowOf(s); return (s.value >= price) !== (tv >= price); };

  const hasBigWall = !!(data.prevHigh && data.prevHigh.price > price && (data.prevHigh.level == null || data.prevHigh.level >= 1));
  const buySemas = data.isBearStock ? allSemas.filter(s => { const m=/SEMA(\d+)/.exec(s.label||''); return m?parseInt(m[1],10)<=9:false; }) : allSemas;
  const _computeDynResist = () => {
    const pv=data.recentPV; if(!pv||pv.length<2||!allSemas.length)return null;
    const today=pv[pv.length-1],yday=pv[pv.length-2];
    const upDownSemas=allSemas.filter(s=>s.value>price&&!isRising(s)).sort((a,b)=>a.value-b.value);
    if(!upDownSemas.length)return null;
    const first=upDownSemas[0];
    if(today.close>yday.close&&!(today.lots<yday.lots)){
      if((first.value-price)/price<=0.02){const second=upDownSemas.find(s=>(s.value-first.value)/first.value>0.02);return second||first;}
    }
    return first;
  };
  const _computeDynSupport = () => {
    const pv=data.recentPV; if(!pv||pv.length<2||!allSemas.length)return null;
    const today=pv[pv.length-1],yday=pv[pv.length-2];
    const downUpSemas=buySemas.filter(s=>s.value<price&&isRising(s)).sort((a,b)=>b.value-a.value);
    if(!downUpSemas.length)return null;
    const first=downUpSemas[0];
    if(today.close<yday.close&&!(today.lots<yday.lots)){
      if((price-first.value)/price<=0.02){const second=downUpSemas.find(s=>(first.value-s.value)/first.value>0.02);return second||first;}
    }
    return first;
  };
  const _dynResist  = _computeDynResist();
  const _dynSupport = _computeDynSupport();
  const sellTarget = _dynResist && !crossesPrice(_dynResist) ? _dynResist : resist.find(s => !crossesPrice(s) && !isRising(s));
  const buyPool = hasBigWall ? support.slice(1) : support;
  const _dynOK = _dynSupport && _dynSupport.value < price;
  const buyTargetUp = (_dynOK ? _dynSupport : null) || buyPool.find(s => s.value < price && isRising(s) && !crossesPrice(s)) || null;
  const backupSupport = buyTargetUp
    ? buyPool.filter(s => s.label !== buyTargetUp.label && s.value < buyTargetUp.value && isRising(s) && !crossesPrice(s))
              .sort((a, b) => b.value - a.value)[0] || null
    : null;

  const gapAbovePct = s => (s.value - price) / price;
  const downCurveWall = resist.find(s => !isRising(s) && gapAbovePct(s) >= 0.003 && gapAbovePct(s) <= 0.015) || null;

  const semaNum = label => label.replace('SEMA','');

  const { ballColor, glowColor, blinkDur } = computeBallColor(data);
  const ballY = toY(price);

  const pctText = v => { const d=((v-price)/price)*100,r=d.toFixed(1); return `${parseFloat(r)===0?'':(d>=0?'+':'')}${r==='-0.0'?'0.0':r}%`; };
  const { topMsg, topSubMsg, botMsg, botSubMsg, topTextColor, dR, dS } = computeGaugeMessages(data);
  const towardResist = dR < dS;

  const numOf = s => parseInt(semaNum(s.label),10)||0;
  const eps = price*0.001;
  const byValThenNum = (a,b) => Math.abs(b.value-a.value)>eps ? b.value-a.value : numOf(a)-numOf(b);
  const resistList  = semas.filter(s=>s.value>=price).sort(byValThenNum);
  const supportList = semas.filter(s=>s.value<price).sort(byValThenNum);
  const resistNamed  = resistList.map(s=>({...s, zhLabel:`${isRising(s)?'▲':'▼'}壓力${semaNum(s.label)}`, isFirst: sellTarget && s.label===sellTarget.label}));
  const supportNamed = supportList.map(s=>({...s, zhLabel:`${isRising(s)?'▲':'▼'}支撐${semaNum(s.label)}`, isFirst: support[0] && s.label===support[0].label, isDynamic: buyTargetUp && s.label===buyTargetUp.label}));

  // Complex label layout (lane assignment)
  const MIN_GAP=18, LBL_LO=12, LBL_HI=H-12;
  const riArr = resistNamed.map(s=>({label:s.label, yCurve:toY(s.value), dist:Math.abs(s.value-price)})).sort((a,b)=>b.yCurve-a.yCurve);
  { let last=null; riArr.forEach(it=>{ it.yLabel=last===null?it.yCurve:Math.min(it.yCurve,last-MIN_GAP); last=it.yLabel; }); }
  const siArr = supportNamed.map(s=>({label:s.label, yCurve:toY(s.value), dist:Math.abs(s.value-price)})).sort((a,b)=>a.yCurve-b.yCurve);
  { let last=null; siArr.forEach(it=>{ it.yLabel=last===null?it.yCurve:Math.max(it.yCurve,last+MIN_GAP); last=it.yLabel; }); }
  if (riArr.length && siArr.length) {
    const r0=riArr[0], s0=siArr[0], gap=s0.yLabel-r0.yLabel;
    if (gap < MIN_GAP) { const need=MIN_GAP-gap; if(r0.dist<s0.dist) siArr.forEach(it=>{it.yLabel+=need;}); else riArr.forEach(it=>{it.yLabel-=need;}); }
  }
  if (riArr.length && riArr[riArr.length-1].yLabel < LBL_LO) {
    let prev=LBL_LO-MIN_GAP; for(let i=riArr.length-1;i>=0;i--){riArr[i].yLabel=Math.max(riArr[i].yLabel,prev+MIN_GAP);prev=riArr[i].yLabel;}
  }
  if (siArr.length && siArr[siArr.length-1].yLabel > LBL_HI) {
    let prev=LBL_HI+MIN_GAP; for(let i=siArr.length-1;i>=0;i--){siArr[i].yLabel=Math.min(siArr[i].yLabel,prev-MIN_GAP);prev=siArr[i].yLabel;}
  }
  const assignLanes = arr => {
    const stepW=labelFont+2;
    arr.forEach(it=>{ it.up=it.yLabel<it.yCurve-0.5; it.flat=Math.abs(it.yLabel-it.yCurve)<=0.5; });
    if (arr.length) arr[0].vx=5;
    const capVx=(it,lane)=>{const maxVx=10+Math.max(0,Math.floor((stepW*it.stepIdx-2)/5))*5; return Math.min(10+lane*5,maxVx);};
    const flats=arr.filter((x,i)=>i!==0&&x.flat);
    const ups=arr.filter((x,i)=>i!==0&&x.up&&!x.flat).concat(flats).sort((a,b)=>a.yLabel-b.yLabel);
    { let lane=0; for(const it of ups){ if(it.flat){it.vx=10;lane=0;}else{it.vx=capVx(it,lane);lane++;} } }
    const downs=arr.filter((x,i)=>i!==0&&!x.up&&!x.flat).concat(flats).sort((a,b)=>b.yLabel-a.yLabel);
    { let lane=0; for(const it of downs){ if(it.flat){it.vx=10;lane=0;}else{it.vx=capVx(it,lane);lane++;} } }
    if (arr.length) arr[0].vx=5;
  };
  riArr.forEach((it,i)=>{it.stepIdx=i;}); siArr.forEach((it,i)=>{it.stepIdx=i;});
  assignLanes(riArr); assignLanes(siArr);
  const resistLeads={}, supportLeads={};
  riArr.forEach(it=>{resistLeads[it.label]={yLabel:it.yLabel,yCurve:it.yCurve,vx:it.vx,stepIdx:it.stepIdx};});
  siArr.forEach(it=>{supportLeads[it.label]={yLabel:it.yLabel,yCurve:it.yCurve,vx:it.vx,stepIdx:it.stepIdx};});

  return (
    <div style={{position:'relative',width:'100%',boxSizing:'border-box',overflowX:'hidden'}}>
      <style>{`
        @keyframes semaFloatY{0%,100%{transform:translateY(0);}50%{transform:translateY(-3px);}}
        @keyframes semaBlink{0%,100%{opacity:1;}50%{opacity:0.35;}}
      `}</style>

      <div style={{marginBottom:8,padding:'10px 12px',borderRadius:9,minHeight:54,boxSizing:'border-box',display:'flex',flexDirection:'column',justifyContent:'center',
        background:'rgba(40,170,100,0.18)', border:'1px solid rgba(80,200,130,0.55)'}}>
        <div style={{fontSize:14,fontWeight:800,color:topTextColor,lineHeight:1.5}}>{towardResist ? '✓ 浮球偏綠，靠近壓力 · ' : ''}{topMsg}</div>
        {topSubMsg && <div style={{fontSize:12,color:'rgba(255,255,255,0.6)',lineHeight:1.5,marginTop:2}}>{topSubMsg}</div>}
      </div>

      <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:8}}>
        {data.tradeDate && <span style={{fontSize:13,color:'#7fa8d0',whiteSpace:'nowrap',flexShrink:0}}>最後交易日 {data.tradeDate}</span>}
        <div style={{flex:1,minWidth:0,padding:'4px 6px',borderRadius:7,background:'#b3261e',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontSize:13,fontWeight:800,color:'#ffffff',letterSpacing:-0.2,lineHeight:1.2,whiteSpace:'nowrap'}}>飭令：嚴禁同學們使用融資、開槓桿、賭身家</span>
        </div>
      </div>

      {data.waveTargets && data.waveTargets.length > 0 && (
        <div style={{display:'flex',alignItems:'stretch',gap:0,marginBottom:8,fontSize:11,lineHeight:1,
          border:'1px solid rgba(127,168,208,0.25)',borderRadius:6,overflow:'hidden'}}>
          <span style={{flexShrink:0,display:'flex',alignItems:'center',padding:'3px 6px',
            background:'#16335c',color:'#dce8f5',fontWeight:700,whiteSpace:'nowrap'}}>波浪推估：</span>
          {[0,1,2].map(i=>{
            const t=data.waveTargets[i];
            if(!t) return null;
            const bg=i===0?'#1e3a24':i===1?'#3a361e':'#3a1e1e';
            const fg=i===0?'#8fe0a0':i===1?'#f0dd70':'#ff7a7a';
            return <div key={i} style={{flex:1,minWidth:0,display:'flex',alignItems:'center',justifyContent:'center',
              gap:4,padding:'3px 4px',background:bg,borderLeft:'1px solid rgba(0,0,0,0.3)',boxSizing:'border-box'}}>
              <span style={{color:fg,fontWeight:700,whiteSpace:'nowrap'}}>({t.ratio})</span>
              <span style={{color:fg,fontWeight:800,whiteSpace:'nowrap'}}>{t.lvl}</span>
            </div>;
          })}
        </div>
      )}

      {data.cdpVals && (
        <div style={{display:'flex',gap:3,marginBottom:8}}>
          {[
            {k:'強支撐',v:data.cdpVals.al, bg:'rgba(46,160,90,0.16)', fg:'#7fd9a0'},
            {k:'主支撐',v:data.cdpVals.nl, bg:'rgba(46,160,90,0.24)', fg:'#8fe0ad'},
            {k:'多空分界',v:data.cdpVals.cdp,bg:'rgba(150,150,150,0.18)',fg:'#d8dde6'},
            {k:'主壓力',v:data.cdpVals.nh, bg:'rgba(200,60,50,0.22)', fg:'#ff9a90'},
            {k:'強壓力',v:data.cdpVals.ah, bg:'rgba(200,60,50,0.16)', fg:'#ff8f85'},
          ].map(c => (
            <div key={c.k} style={{flex:1,background:c.bg,borderRadius:5,padding:'2px 1px',textAlign:'center',boxSizing:'border-box'}}>
              <div style={{fontSize:10,fontWeight:700,color:c.fg,opacity:0.8,lineHeight:1.2,whiteSpace:'nowrap'}}>{c.k}</div>
              <div style={{fontSize:10,fontWeight:800,color:c.fg,lineHeight:1.2}}>{c.v}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{display:'flex',height:H}}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{flexShrink:0}}>
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#8e2018"/>
              <stop offset="20%"  stopColor="#a03030"/>
              <stop offset="38%"  stopColor="#c86060"/>
              <stop offset="46%"  stopColor="#c8ccd4"/>
              <stop offset="54%"  stopColor="#c8ccd4"/>
              <stop offset="62%"  stopColor="#5cb072"/>
              <stop offset="80%"  stopColor="#2c9050"/>
              <stop offset="100%" stopColor="#15682c"/>
            </linearGradient>
            <linearGradient id="cylShape" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#000000" stopOpacity="0.35"/>
              <stop offset="18%"  stopColor="#ffffff" stopOpacity="0.45"/>
              <stop offset="32%"  stopColor="#ffffff" stopOpacity="0.08"/>
              <stop offset="65%"  stopColor="#ffffff" stopOpacity="0"/>
              <stop offset="88%"  stopColor="#000000" stopOpacity="0.18"/>
              <stop offset="100%" stopColor="#000000" stopOpacity="0.5"/>
            </linearGradient>
            <linearGradient id="floatShine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.5"/>
              <stop offset="50%"  stopColor="#ffffff" stopOpacity="0"/>
              <stop offset="100%" stopColor="#000000" stopOpacity="0.4"/>
            </linearGradient>
            <clipPath id="gaugeClip">
              <rect x="0" y="0" width={W} height={H} rx="16"/>
            </clipPath>
            <clipPath id="curveClip">
              <rect x={xL} y="0" width={xR-xL} height={H}/>
            </clipPath>
          </defs>
          <rect x="0" y="0" width={W} height={H} rx="16" fill="url(#gaugeGrad)" stroke="rgba(0,0,0,0.18)"/>
          <g clipPath="url(#curveClip)">
          {semas.map(s => {
            const isResist=s.value>=price, isNearest=(sellTarget&&s.label===sellTarget.label)||(buyTargetUp&&s.label===buyTargetUp.label);
            const isKey=KEY_SEMA_SET.has(s.label)||isNearest, col=semaColor(s.label,isResist);
            const cleanRecent=(s.recent||[]).filter(v=>v!=null&&!isNaN(v));
            const smooth=arr=>arr.map((v,i)=>i===0||i===arr.length-1?v:v*0.5+arr[i-1]*0.25+arr[i+1]*0.25);
            const rawRecent=cleanRecent.length>=2?cleanRecent:[s.value,s.value];
            const pts=smooth(rawRecent), n=pts.length;
            const visStart=Math.max(0,n-VIS), denom=n-1-visStart||1;
            const coords=pts.map((v,i)=>[xL+(i-visStart)/denom*(xR-xL),toY(v)]);
            let d=`M ${coords[0][0].toFixed(2)} ${coords[0][1].toFixed(2)}`;
            for(let i=0;i<coords.length-1;i++){
              const p0=coords[i===0?0:i-1],p1=coords[i],p2=coords[i+1],p3=coords[i+2]||p2;
              const c1x=p1[0]+(p2[0]-p0[0])/6, c1y=p1[1]+(p2[1]-p0[1])/6;
              const c2x=p2[0]-(p3[0]-p1[0])/6, c2y=p2[1]-(p3[1]-p1[1])/6;
              d+=` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
            }
            return <path key={s.label} d={d} fill="none" stroke={col} strokeWidth={isKey?3.5:2} strokeLinecap="round" strokeLinejoin="round"/>;
          })}
          </g>
          {semas.map(s => {
            const col=semaColor(s.label,s.value>=price), y=toYClamped(s.value);
            return <g key={`dt-${s.label}`}>
              <circle cx={xR} cy={y} r="2.5" fill={col}/>
              <line x1={xR} y1={y} x2={W-1} y2={y} stroke={col} strokeWidth="1.2" opacity="0.8"/>
            </g>;
          })}
          <g style={{animation:'semaFloatY 3.2s ease-in-out infinite'}}>
            <g style={{animation:blinkDur?`semaBlink ${blinkDur}s ease-in-out infinite`:'none'}}>
              <rect x={4} y={ballY-bandH/2} width={W-8} height={bandH} rx={bandH/2}
                fill={ballColor} stroke="rgba(0,0,0,0.55)" strokeWidth="0.6"
                style={{filter:`drop-shadow(0 0 ${blinkDur?6:3}px ${glowColor})`}}/>
              <rect x={4} y={ballY-bandH/2} width={W-8} height={bandH} rx={bandH/2}
                fill="url(#floatShine)" pointerEvents="none"/>
            </g>
            <text x={W/2} y={ballY-bandH/2-5} fontWeight="900" fill="#0a0a0a" textAnchor="middle"
              style={{paintOrder:'stroke',stroke:'rgba(255,255,255,0.9)',strokeWidth:3}}>
              <tspan fontSize="18">
                {(Math.round(price*100)%100===0?Math.round(price):price).toLocaleString('en-US',{
                  minimumFractionDigits:Math.round(price*100)%100===0?0:price<50?2:1,
                  maximumFractionDigits:price<50?2:1
                })}
              </tspan>
            </text>
          </g>
          <rect x="0" y="0" width={W} height={H} rx="16" fill="url(#cylShape)" pointerEvents="none"/>
          <g clipPath="url(#gaugeClip)">
            <ellipse cx="16" cy="180" rx="2" ry="20" fill="#ffffff" opacity="0.25" pointerEvents="none"/>
          </g>
        </svg>

        <div style={{flex:1,position:'relative',minWidth:0}}>
          <svg viewBox={`0 0 ${LEAD_W} ${H}`} preserveAspectRatio="none"
            style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none',overflow:'visible'}}>
            {[...resistNamed,...supportNamed].map(s => {
              const isResist=s.value>=price, col=semaColor(s.label,isResist);
              const lead=isResist?resistLeads[s.label]:supportLeads[s.label];
              if (!lead) return null;
              const stepW=labelFont+2, xLabel=10+lead.stepIdx*stepW, xEnd=xLabel-2;
              const d=`M -8 ${lead.yCurve.toFixed(1)} H ${lead.vx} V ${lead.yLabel.toFixed(1)} H ${xEnd.toFixed(1)}`;
              return <path key={`ld-${s.label}`} d={d} fill="none" stroke={col} strokeWidth="1" opacity="0.8" vectorEffect="non-scaling-stroke"/>;
            })}
          </svg>
          {resistNamed.map(s => {
            const c=semaColor(s.label,true), lead=resistLeads[s.label];
            if (!lead) return null;
            const stepW=labelFont+2, leftPct=((10+lead.stepIdx*stepW)/LEAD_W*100).toFixed(1)+'%', topPct=(lead.yLabel/H*100).toFixed(2)+'%';
            return <div key={s.label} style={{position:'absolute',top:topPct,transform:'translateY(-50%)',left:leftPct,right:0,fontSize:labelFont,fontWeight:s.isFirst?900:600,color:s.isFirst?'#ffffff':c,whiteSpace:'nowrap'}}>
              <span style={s.isFirst?{background:'rgba(40,150,70,0.55)',padding:'1px 4px',borderRadius:3}:undefined}>
                {`<${s.zhLabel}> ${s.value.toFixed(s.value<50?2:1)} `}
                <span style={{color:s.isFirst?'#ffffff':c,opacity:s.isFirst?0.9:0.8}}>{`(${pctText(s.value)})`}</span>
              </span>
            </div>;
          })}
          {supportNamed.map(s => {
            const c=semaColor(s.label,false), lead=supportLeads[s.label];
            if (!lead) return null;
            const stepW=labelFont+2, leftPct=((10+lead.stepIdx*stepW)/LEAD_W*100).toFixed(1)+'%', topPct=(lead.yLabel/H*100).toFixed(2)+'%';
            return <div key={s.label} style={{position:'absolute',top:topPct,transform:'translateY(-50%)',left:leftPct,right:0,fontSize:labelFont,fontWeight:(s.isFirst||s.isDynamic)?900:600,color:s.isDynamic?'#ffffff':c,whiteSpace:'nowrap'}}>
              <span style={s.isDynamic?{background:'rgba(200,40,40,0.55)',padding:'1px 4px',borderRadius:3}:undefined}>
                {`<${s.zhLabel}> ${s.value.toFixed(s.value<50?2:1)} `}
                <span style={{color:s.isDynamic?'#ffffff':c,opacity:s.isDynamic?0.9:0.8}}>{`(${pctText(s.value)})`}</span>
              </span>
            </div>;
          })}
        </div>
      </div>

      {data.volSeries?.length > 0 && (() => {
        const vols=data.volSeries, maxVol=Math.max(...vols.map(v=>Math.max(v.lots,v.ma17,v.ma45)),1);
        const vW=W, vH=81, gap=1, barW=(vW-gap*(vols.length-1))/vols.length;
        const cx=i=>i*(barW+gap)+barW/2, cy=val=>vH-(val/maxVol)*(vH-4);
        const lp=key=>vols.map((v,i)=>`${i===0?'M':'L'} ${cx(i).toFixed(1)} ${cy(v[key]).toFixed(1)}`).join(' ');
        return <div style={{display:'flex',gap:0,marginTop:4}}>
          <svg width={vW} height={vH} viewBox={`0 0 ${vW} ${vH}`} style={{flexShrink:0}}>
            <defs>
              <linearGradient id="volShine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#000000" stopOpacity="0.3"/>
                <stop offset="20%" stopColor="#ffffff" stopOpacity="0.4"/>
                <stop offset="55%" stopColor="#ffffff" stopOpacity="0"/>
                <stop offset="100%" stopColor="#000000" stopOpacity="0.35"/>
              </linearGradient>
            </defs>
            {vols.map((v,i)=>{
              const h=(v.lots/maxVol)*(vH-4);
              return <React.Fragment key={i}>
                <rect x={i*(barW+gap)} y={vH-h} width={barW} height={h} fill={v.up?'#c0392b':'#27ae60'} opacity="0.85"/>
                <rect x={i*(barW+gap)} y={vH-h} width={barW} height={h} fill="url(#volShine)" pointerEvents="none"/>
              </React.Fragment>;
            })}
            <path d={lp('ma17')} fill="none" stroke="#e0c020" strokeWidth="1.3" opacity="0.95"/>
            <path d={lp('ma45')} fill="none" stroke="#2aa5b0" strokeWidth="1.3" opacity="0.95"/>
          </svg>
          <div style={{flex:1,paddingLeft:8,display:'flex',alignItems:'flex-end',gap:14}}>
            <div style={{display:'flex',flexDirection:'column',gap:1,whiteSpace:'nowrap'}}>
              <div style={{fontSize:12,color:'#8a96ad'}}>{data.isTw ? `今日成交量: ${data.volLots?.toLocaleString()} 張` : `今日成交量: ${((data.volLots||0)*1000).toLocaleString()} 股`}</div>
              {data.volRatio!=null && <div style={{fontSize:12,color:data.volRatio>=1?'#ff8a8a':'#8fd9a8'}}>{`今日量比: ${data.volRatio.toFixed(2)}`}</div>}
              {data.intraday?.estTodayVolLots!=null && <div style={{fontSize:12,color:'#3fb8c4'}}>{data.isTw ? `今日預估量: ${data.intraday.estTodayVolLots.toLocaleString()} 張` : `今日預估量: ${(data.intraday.estTodayVolLots*1000).toLocaleString()} 股`}</div>}
            </div>
          </div>
        </div>;
      })()}

      <div style={{marginTop:8,padding:'10px 12px',borderRadius:9,minHeight:54,boxSizing:'border-box',display:'flex',flexDirection:'column',justifyContent:'center',background:'rgba(200,60,60,0.18)',border:'1px solid rgba(230,100,100,0.55)'}}>
        <div style={{fontSize:14,fontWeight:800,color:'#f0b8b8',lineHeight:1.5}}>{towardResist ? '' : '✓ 浮球偏紅，靠近支撐 · '}{botMsg}</div>
        {botSubMsg && <div style={{fontSize:12,color:'rgba(255,255,255,0.6)',lineHeight:1.5,marginTop:2}}>{botSubMsg}</div>}
      </div>
    </div>
  );
}

function StatsPanel({ data }) {
  const semas = data.semas || [], price = data.price;
  const resistList = semas.filter(s=>s.value>=price).sort((a,b)=>a.value-b.value);
  const supportList= semas.filter(s=>s.value<price).sort((a,b)=>b.value-a.value);
  const nearR = resistList[0], nearS = supportList[0];
  const distR = nearR ? ((nearR.value-price)/price*100).toFixed(1) : null;
  const distS = nearS ? ((price-nearS.value)/price*100).toFixed(1) : null;
  const vr = data.volRatio;
  const vrColor = !vr?'var(--text-md)':vr>=2?'#ef4444':vr>=1.3?'#f97316':vr>=0.8?'var(--accent)':'var(--text-md)';
  const vrLabel = !vr?'—':vr>=2?'爆量':vr>=1.3?'放量':vr>=0.8?'正常':'縮量';
  const specials = [];
  if (data.seaWideOpen) specials.push({ txt:'海闊天空，無密集均線', col:'#60a5fa' });
  if (data.noResist)    specials.push({ txt:'目前無壓力均線', col:'#22c55e' });
  if (data.noSupport)   specials.push({ txt:'目前無支撐均線', col:'#ef4444' });
  const intra = data.intraday || {};
  const miniVols = [
    { label:'5分K',  r:intra.r5,  est:intra.est5  },
    { label:'15分K', r:intra.r15, est:intra.est15 },
    { label:'30分K', r:intra.r30, est:intra.est30 },
  ].filter(x=>x.r!=null);

  const hasExtra = miniVols.length > 0 || specials.length > 0;
  return (
    <div className="glass p-4 mb-4">
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:9,marginBottom:hasExtra?12:0}}>
        <div className="stat-card">
          <div className="stat-label">最近壓力</div>
          {nearR ? <>
            <div className="stat-value" style={{color:'#ff6b6b'}}>+{distR}%</div>
            <div className="stat-sub" style={{color:'#cbd5e1'}}>{nearR.label} · {nearR.value.toFixed(nearR.value<50?2:1)}</div>
          </> : <div className="stat-value" style={{color:'#22c55e',fontSize:15}}>無壓力</div>}
        </div>
        <div className="stat-card">
          <div className="stat-label">最近支撐</div>
          {nearS ? <>
            <div className="stat-value" style={{color:'#4ade80'}}>-{distS}%</div>
            <div className="stat-sub" style={{color:'#cbd5e1'}}>{nearS.label} · {nearS.value.toFixed(nearS.value<50?2:1)}</div>
          </> : <div className="stat-value" style={{color:'#ef4444',fontSize:15}}>無支撐</div>}
        </div>
        <div className="stat-card">
          <div className="stat-label">今日成交量</div>
          <div className="stat-value" style={{color:'#f1f5f9'}}>{data.isTw ? (data.volLots?.toLocaleString()??'—') : (((data.volLots||0)*1000).toLocaleString())}</div>
          <div className="stat-sub" style={{color:'#cbd5e1'}}>{data.isTw ? '張' : '股'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">量比</div>
          {vr!=null ? <>
            <div className="stat-value" style={{color:vrColor}}>{vr.toFixed(2)}×</div>
            <div className="stat-sub" style={{color:vrColor}}>{vrLabel}</div>
          </> : <div className="stat-value" style={{color:'#cbd5e1'}}>—</div>}
        </div>
      </div>

      {miniVols.length > 0 && (
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:specials.length?10:0}}>
          {miniVols.map(x=>(
            <div key={x.label} className="vol-mini">
              <div style={{fontSize:11,color:'#38bdf8',fontWeight:700,letterSpacing:'0.08em',marginBottom:3}}>{x.label}量比</div>
              <div style={{fontSize:16,fontWeight:800,color:'#9cc4ec',fontFamily:'monospace'}}>{x.r.toFixed(2)}×</div>
              {x.est!=null && <div style={{fontSize:11,color:'#cbd5e1',marginTop:2}}>預估 {x.est.toLocaleString()} 張</div>}
            </div>
          ))}
          {intra.estTodayVolLots!=null && (
            <div style={{flex:1,minWidth:72,background:'rgba(99,102,241,0.05)',border:'1px solid rgba(99,102,241,0.15)',borderRadius:8,padding:'8px 10px'}}>
              <div style={{fontSize:11,color:'#818cf8',fontWeight:700,letterSpacing:'0.08em',marginBottom:3}}>今日預估量</div>
              <div style={{fontSize:16,fontWeight:800,color:'#a5b4fc',fontFamily:'monospace'}}>{intra.estTodayVolLots.toLocaleString()}</div>
              <div style={{fontSize:11,color:'#cbd5e1',marginTop:2}}>張</div>
            </div>
          )}
        </div>
      )}

      {specials.map((s,i)=>(
        <div key={i} style={{marginTop:i===0?0:6,display:'flex',alignItems:'center',gap:8,padding:'7px 11px',borderRadius:8,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)'}}>
          <div style={{width:5,height:5,borderRadius:'50%',background:s.col,boxShadow:`0 0 6px ${s.col}`,flexShrink:0}}/>
          <span style={{fontSize:14,fontWeight:700,color:s.col}}>{s.txt}</span>
        </div>
      ))}
    </div>
  );
}

// ── PriceRail 位階尺 ──
export function PriceRail({ data }) {
  const { price, semas } = data;
  const ph = data.prevHigh;
  const vals = [price, ...semas.map(s => s.value)];
  if (ph?.price > price) vals.push(ph.price);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const span = (maxV - minV) || price * 0.1;
  const lo = minV - span * 0.12, hi = maxV + span * 0.12;
  const toX = v => `${Math.max(1, Math.min(99, ((v - lo) / (hi - lo)) * 100)).toFixed(1)}%`;
  const priceX = toX(price);
  const fmtV = v => v < 100 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US');
  const isRising = s => { const r=(s.recent||[]).filter(x=>x!=null&&!isNaN(x)); return r.length>=2&&r[r.length-1]>r[r.length-2]; };

  const { ballColor, glowColor, blinkDur, sellTarget, buyTargetUp } = computeBallColor(data);

  return (
    <div style={{padding:'16px 0 14px',position:'relative',userSelect:'none'}}>
      <div style={{position:'absolute',top:0,left:priceX,transform:'translateX(-50%)',
        fontSize:11,fontWeight:800,color:'#f1f5f9',fontFamily:'monospace',whiteSpace:'nowrap',lineHeight:1}}>
        {fmtV(price)}
      </div>
      <div style={{position:'relative',height:14,borderRadius:7,
        background:`linear-gradient(to right, rgba(26,107,53,0.8) 0%, rgba(42,125,79,0.8) ${priceX}, rgba(122,30,30,0.8) ${priceX}, rgba(74,16,16,0.8) 100%)`}}>
        {semas.map(s => {
          const isResist = s.value >= price;
          const isKey = s.label === sellTarget?.label || s.label === buyTargetUp?.label;
          return <div key={s.label} style={{position:'absolute',left:toX(s.value),top:isKey?-5:-3,bottom:isKey?-5:-3,width:isKey?3:2,
            background:semaColor(s.label, isResist),opacity:isKey?1:0.8,transform:'translateX(-50%)',borderRadius:1}}/>;
        })}
        {ph?.price > price && (
          <div style={{position:'absolute',left:toX(ph.price),top:-4,bottom:-4,width:2,
            background:'#fbbf24',opacity:0.85,transform:'translateX(-50%)'}}/>
        )}
        <div style={{position:'absolute',left:priceX,top:'50%',transform:'translate(-50%,-50%)',
          width:20,height:20,borderRadius:'50%',background:ballColor,
          boxShadow:`0 1px 6px rgba(0,0,0,0.5), 0 0 ${blinkDur?8:4}px ${glowColor}`,
          border:'1.5px solid rgba(255,255,255,0.35)',zIndex:2,
          animation:blinkDur?`semaBlink ${blinkDur}s ease-in-out infinite`:'none'}}/>
      </div>
      <div style={{position:'relative',height:16,marginTop:4}}>
        {buyTargetUp && (
          <div style={{position:'absolute',left:toX(buyTargetUp.value),transform:'translateX(-50%)',
            fontSize:10,fontWeight:800,color:semaColor(buyTargetUp.label, false),fontFamily:'monospace',whiteSpace:'nowrap'}}>
            {isRising(buyTargetUp)?'▲':'▼'}{fmtV(buyTargetUp.value)}
          </div>
        )}
        {sellTarget && (
          <div style={{position:'absolute',left:toX(sellTarget.value),transform:'translateX(-50%)',
            fontSize:10,fontWeight:800,color:semaColor(sellTarget.label, true),fontFamily:'monospace',whiteSpace:'nowrap'}}>
            {isRising(sellTarget)?'▲':'▼'}{fmtV(sellTarget.value)}
          </div>
        )}
        {ph?.price > price && (
          <div style={{position:'absolute',left:toX(ph.price),transform:'translateX(-50%)',
            fontSize:10,color:'#fbbf24',fontFamily:'monospace',whiteSpace:'nowrap'}}>
            {fmtV(ph.price)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DashCard 儀表板卡片（props-driven，由 Dashboard 注入資料）──
function DashCard({ item, state, data, onExpand }) {
  const { code } = item;
  const msgs = data ? computeGaugeMessages(data) : null;
  const chg = data?.change ?? 0;
  const chgColor = chg >= 0 ? '#ff5a5a' : '#33cc77';

  return (
    <div className="glass" style={{padding:'12px 14px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:6,marginBottom:2}}>
        <div style={{display:'flex',alignItems:'baseline',gap:6,minWidth:0}}>
          <span style={{fontSize:17,fontWeight:900,color:'#f1f5f9',flexShrink:0}}>{code}</span>
          {data && <span style={{fontSize:11,color:'#7fa8d0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{data.name}</span>}
        </div>
        {data && <div style={{flexShrink:0}}>
          <span style={{fontSize:15,fontWeight:800,color:chgColor,fontFamily:'monospace'}}>
            {data.price.toFixed(data.price < 50 ? 2 : 1)}
          </span>
          <span style={{fontSize:11,color:chgColor,marginLeft:4}}>{chg>=0?'+':''}{data.changePct}%</span>
        </div>}
      </div>
      {state==='loading' && (
        <div style={{height:60,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <span className="sema-spinner"/><span style={{fontSize:13,color:'#7fa8d0'}}>載入中...</span>
        </div>
      )}
      {state==='error' && (
        <div style={{height:60,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#f87171'}}>載入失敗</div>
      )}
      {state==='done' && data && msgs && <>
        <PriceRail data={data}/>
        <div style={{margin:'8px 0 4px',padding:'8px 10px',borderRadius:8,
          background:'rgba(40,170,100,0.18)',border:'1px solid rgba(80,200,130,0.55)'}}>
          <div style={{fontSize:12,fontWeight:800,color:msgs.topTextColor,lineHeight:1.5}}>{msgs.topMsg}</div>
          {msgs.topSubMsg && <div style={{fontSize:10.5,color:'rgba(255,255,255,0.6)',lineHeight:1.5,marginTop:2}}>{msgs.topSubMsg}</div>}
        </div>
        <div style={{padding:'8px 10px',borderRadius:8,
          background:'rgba(200,60,60,0.18)',border:'1px solid rgba(230,100,100,0.55)'}}>
          <div style={{fontSize:12,fontWeight:800,color:'#f0b8b8',lineHeight:1.5}}>{msgs.botMsg}</div>
          {msgs.botSubMsg && <div style={{fontSize:10.5,color:'rgba(255,255,255,0.6)',lineHeight:1.5,marginTop:2}}>{msgs.botSubMsg}</div>}
        </div>
        <div style={{marginTop:8,textAlign:'right'}}>
          <button onClick={()=>onExpand(code)}
            style={{fontSize:12,color:'var(--accent)',background:'none',border:'1px solid var(--accent-a25)',borderRadius:5,padding:'3px 10px',cursor:'pointer',fontWeight:700}}>
            展開分析 →
          </button>
        </div>
      </>}
    </div>
  );
}

// ── Dashboard 儀表板（批次抓取，一次 request 取所有卡片資料）──
function Dashboard({ watchlist, onExpand }) {
  const [batchState, setBatchState] = useState('loading');
  const [batchData,  setBatchData]  = useState({});

  const load = useCallback(() => {
    if (!watchlist.length) return;
    setBatchState('loading'); setBatchData({});
    const symbols = watchlist.map(w => {
      const s = w.code.trim().toUpperCase();
      return /^\d{4}$/.test(s) ? s + '.TW' : s;
    });
    window.fetchSemaBatch(symbols)
      .then(map => { setBatchData(map); setBatchState('done'); })
      .catch(() => setBatchState('error'));
  }, [watchlist]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{marginBottom:16,padding:'14px 16px',borderRadius:14,
      background:'rgba(196,155,26,0.04)',
      border:'1px solid rgba(196,155,26,0.22)',
      boxShadow:'0 0 0 1px rgba(196,155,26,0.08)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:11,fontWeight:800,letterSpacing:'0.14em',color:'rgba(196,155,26,0.85)',textTransform:'uppercase'}}>⊞ 位階尺儀表板</span>
        </div>
        <button onClick={load}
          style={{fontSize:13,color:'#7fa8d0',background:'none',border:'none',cursor:'pointer'}}>↺ 重新整理</button>
      </div>
      {watchlist.length === 0
        ? <div style={{textAlign:'center',color:'#7fa8d0',fontSize:14,lineHeight:1.8,padding:'12px 0'}}>
            觀察清單是空的<br/>
            <span style={{fontSize:12,color:'#cbd5e1'}}>分析任一股票後，點擊「+ 觀察清單」加入</span>
          </div>
        : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:10}}>
            {watchlist.map(w => {
              const key = /^\d{4}$/.test(w.code.trim()) ? w.code.trim() + '.TW' : w.code.trim().toUpperCase();
              const cardData  = batchData[key];
              const cardState = batchState === 'done' ? (cardData?.error ? 'error' : 'done') : batchState;
              return <DashCard key={w.code} item={w} state={cardState} data={cardData?.error ? null : cardData} onExpand={onExpand}/>;
            })}
          </div>
      }
    </div>
  );
}

function SemaApp() {
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [sysMsg,     setSysMsg]     = useState('輸入股票代碼開始');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [nowClock,   setNowClock]   = useState('');
  const [history,    setHistory]    = useState([]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [watchlist,  setWatchlist]  = useState(() => {
    try { return JSON.parse(localStorage.getItem('sema_watchlist')||'[]'); } catch { return []; }
  });
  const [waveL1, setWaveL1] = useState('');
  const [waveH1, setWaveH1] = useState('');
  const [waveL2, setWaveL2] = useState('');
  const waveL1Ref = useRef('');
  const waveH1Ref = useRef('');
  const waveL2Ref = useRef('');
  waveL1Ref.current = waveL1;
  waveH1Ref.current = waveH1;
  waveL2Ref.current = waveL2;
  const WAVE_MEM_KEY = 'sunny_wave_mem_v1';
  const readWaveMem = code => {
    try { const m = JSON.parse(localStorage.getItem(WAVE_MEM_KEY)||'{}'); return m[code]||null; } catch { return null; }
  };
  const saveWaveMem = (code, l1, h1, l2) => {
    try { const m = JSON.parse(localStorage.getItem(WAVE_MEM_KEY)||'{}'); m[code]={l1,h1,l2}; localStorage.setItem(WAVE_MEM_KEY,JSON.stringify(m)); } catch {}
  };
  const containerRef = useRef(null);
  const priceRowRef  = useRef(null);
  const [gaugeW, setGaugeW] = useState(120);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setGaugeW(Math.round(Math.max(150, Math.min(240, entry.contentRect.width * 0.40))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const tick = () => {
      const d=new Date(), p2=n=>String(n).padStart(2,'0');
      setNowClock(`${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`);
    };
    tick(); const id=setInterval(tick,1000); return ()=>clearInterval(id);
  }, []);

  useEffect(() => {
    localStorage.setItem('sema_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  const data = history[historyIdx]?.data ?? null;

  const analyze = useCallback(async rawCode => {
    const code = (rawCode||'').trim().toUpperCase();
    if (!code) return;
    const wl1=waveL1Ref.current.trim(), wh1=waveH1Ref.current.trim(), wl2=waveL2Ref.current.trim();
    const anyWave = wl1!==''||wh1!==''||wl2!=='';
    if (anyWave) {
      const n1=parseFloat(wl1), nH=parseFloat(wh1), n2=parseFloat(wl2);
      if (wl1===''||wh1===''||wl2===''||isNaN(n1)||isNaN(nH)||isNaN(n2)) { setErrorMsg('浪高推估: L1/H1/L2 需都填數字(或全部清空)'); return; }
      if (n1<=0||nH<=0||n2<=0) { setErrorMsg('浪高推估: L1/H1/L2 不得為 0'); return; }
      if (nH<=n1) { setErrorMsg('浪高推估: H1 須大於 L1'); return; }
      if (n2<=n1) { setErrorMsg('浪高推估: L2 須大於 L1'); return; }
      if (n2>=nH) { setErrorMsg('浪高推估: L2 須小於 H1'); return; }
    }
    setErrorMsg(''); setLoading(true); setSysMsg(`${code} 分析中...`);
    try {
      const json = await fetch(`${SEMA_API}?symbol=${encodeURIComponent(code)}`).then(r=>r.json());
      if (json.error) throw new Error(json.error);
      const _l1=parseFloat(waveL1Ref.current), _h1=parseFloat(waveH1Ref.current), _l2=parseFloat(waveL2Ref.current);
      if (!isNaN(_l1)&&!isNaN(_h1)&&!isNaN(_l2)&&_h1>_l1&&_l2>_l1&&_l2<_h1&&_l1>0) {
        saveWaveMem(code, waveL1Ref.current.trim(), waveH1Ref.current.trim(), waveL2Ref.current.trim());
        const wSpan=_h1-_l1;
        const wavePrice = json.todayHi || json.price;
        const fmtTp=v=>v<100?v.toFixed(2):Math.round(v).toLocaleString('en-US');
        const fmtR=r=>{const s=r.toFixed(3);return s.replace(/0+$/,'').replace(/\.$/,'');};
        const FRAC=[0.0,0.191,0.382,0.5,0.618,0.809];
        const ups=[];
        for (let n=0;n<1000&&ups.length<3;n++){
          for (const f of FRAC){
            const ratio=n+f; if(ratio<0.191) continue;
            const lvl=_l2+wSpan*ratio;
            if(lvl>wavePrice){ ups.push({ratio:fmtR(ratio),lvl:fmtTp(lvl)}); if(ups.length>=3) break; }
          }
        }
        if(ups.length>0) json.waveTargets=ups;
      }
      setHistory(prev => {
        const filtered = prev.filter(h=>h.data.code!==json.code);
        return [{ data:json, ts:Date.now() }, ...filtered].slice(0,6);
      });
      setHistoryIdx(0);
      setSysMsg(`${json.name} 分析完成 ✓`);
      setTimeout(() => priceRowRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 100);
    } catch(e) {
      setErrorMsg(`分析失敗：${e.message}`); setSysMsg('輸入股票代碼開始');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    window.quickSema = code => {
      setInput(code); analyze(code);
      document.querySelectorAll('.tab-panel').forEach(el=>el.classList.remove('active'));
      document.querySelectorAll('[data-tab]').forEach(el=>el.classList.remove('active'));
      document.getElementById('tab-sema').classList.add('active');
      document.querySelectorAll('[data-tab="sema"]').forEach(el=>el.classList.add('active'));
    };
    return () => { delete window.quickSema; };
  }, [analyze]);

  const addWatch = () => {
    if (data && !watchlist.find(w=>w.code===data.code))
      setWatchlist(prev=>[...prev,{code:data.code,name:data.name}]);
  };
  const removeWatch = code => setWatchlist(prev=>prev.filter(w=>w.code!==code));

  const handleExpand = useCallback(code => {
    setInput(code); analyze(code);
  }, [analyze]);

  const QUICK = ['SMCI','NVTS','MU','2330','2317','2454'];

  return (
    <div ref={containerRef}>
      <div style={{overflow:'hidden',whiteSpace:'nowrap',marginBottom:12,borderTop:'1px solid var(--accent-a08)',borderBottom:'1px solid var(--accent-a08)',padding:'4px 0'}}>
        <div style={{display:'inline-block',paddingLeft:'100%',animation:'semaMarquee 24s linear infinite',fontSize:13,color:'#cbd5e1'}}>
          ⚠ 本工具僅供技術分析學習與參考，不構成任何投資建議。股市有風險，投資需謹慎，所有買賣決策請自行判斷並承擔盈虧。
        </div>
      </div>

      <div className="glass p-5 mb-4 shadow-2xl">
        <label className="section-label block mb-2">股票代碼</label>
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          <input className="field" style={{flex:1}} value={input}
            onChange={e=>{
              const v=e.target.value; setInput(v);
              const c=v.trim().toUpperCase();
              const mem=c?readWaveMem(c):null;
              if(mem){setWaveL1(mem.l1||'');setWaveH1(mem.h1||'');setWaveL2(mem.l2||'');}
            }}
            onFocus={()=>{setInput('');setWaveL1('');setWaveH1('');setWaveL2('');}}
            onKeyDown={e=>{if(e.key==='Enter')analyze(input);}}
            placeholder="SMCI / AAPL / 2330 / 2330.TW" maxLength={10}/>
          <button onClick={()=>analyze(input)} className="sema-exec-btn" disabled={loading}
            style={{padding:'0 20px',borderRadius:10,fontWeight:800,fontSize:16,border:'none',cursor:'pointer',whiteSpace:'nowrap',
              background:'var(--gradient-btn)',color:'#050c1a',opacity:loading?0.5:1}}>
            {loading?'分析中...':'執行'}
          </button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
          {[[waveL1,setWaveL1,'L1'],[waveH1,setWaveH1,'H1'],[waveL2,setWaveL2,'L2']].map(([val,setter,ph],idx)=>(
            <input key={idx} value={val} onChange={e=>setter(e.target.value)}
              placeholder={ph} inputMode="decimal"
              onKeyDown={e=>{if(e.key==='Enter')analyze(input);}}
              style={{width:'100%',minWidth:0,height:34,boxSizing:'border-box',padding:'0 10px',
                fontSize:14,borderRadius:10,textAlign:'center',
                border:'1px solid rgba(127,168,208,0.4)',background:'rgba(255,255,255,0.06)',
                color:'#fff',outline:'none'}}/>
          ))}
        </div>
        <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:7,marginBottom:10}}>
          <span className="section-label">快捷</span>
          {QUICK.map(s=>(
            <button key={s} className="quick-btn" onClick={()=>{setInput(s);analyze(s);}}>{s}</button>
          ))}
        </div>
        {watchlist.length > 0 && (
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {watchlist.map(w=>(
              <div key={w.code} style={{display:'flex',alignItems:'center',borderRadius:8,overflow:'hidden',border:'1px solid var(--accent-a25)'}}>
                <button onClick={()=>{setInput(w.code);analyze(w.code);}}
                  style={{padding:'4px 10px',fontSize:14,fontWeight:700,color:'var(--accent)',background:'var(--accent-a06)',border:'none',cursor:'pointer'}}>
                  {w.code}
                </button>
                <button onClick={()=>removeWatch(w.code)}
                  style={{padding:'4px 7px',fontSize:13,color:'var(--text-md)',background:'var(--accent-a04)',border:'none',borderLeft:'1px solid var(--accent-a15)',cursor:'pointer'}}
                  onMouseOver={e=>e.currentTarget.style.color='#ef4444'} onMouseOut={e=>e.currentTarget.style.color='#cbd5e1'}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {watchlist.length > 0 && <Dashboard watchlist={watchlist} onExpand={handleExpand}/>}

      {errorMsg
        ? <div style={{textAlign:'center',color:'#f87171',fontSize:15,margin:'8px 0'}}>{errorMsg}</div>
        : <div style={{textAlign:'center',color:'#cbd5e1',fontSize:14,margin:'4px 0 12px',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            {loading && <span className="sema-spinner"/>}
            <span>{sysMsg}</span>
          </div>}

      {history.length > 1 && (
        <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:6,marginBottom:12}}>
          <span className="section-label" style={{marginRight:2}}>本次紀錄</span>
          {history.map((h,i)=>(
            <button key={h.data.code} onClick={()=>setHistoryIdx(i)}
              style={{padding:'4px 12px',borderRadius:7,fontSize:14,fontWeight:700,cursor:'pointer',
                border:`1px solid ${i===historyIdx?'var(--accent-a45)':'rgba(255,255,255,0.08)'}`,
                background:i===historyIdx?'var(--accent-a10)':'rgba(255,255,255,0.02)',
                color:i===historyIdx?'var(--accent)':'var(--text-md)'}}>
              {h.data.code}
            </button>
          ))}
        </div>
      )}

      {data && <>
        <div ref={priceRowRef} className="glass p-4 mb-4" style={{scrollMarginTop:12}}>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'center',flexWrap:'wrap',gap:8}}>
            <span style={{fontSize:16,fontWeight:800,color:'#cfd6e4'}}>{data.code} {data.name}</span>
            <span style={{fontSize:26,fontWeight:900,fontFamily:'monospace',color:data.change>=0?'#ff5a5a':'#33cc77'}}>
              {data.price.toFixed(data.price<50?2:1)}
            </span>
            <span style={{fontSize:15,fontWeight:700,color:data.change>=0?'#ff5a5a':'#33cc77'}}>
              {data.change>=0?'+':''}{data.change} ({data.change>=0?'+':''}{data.changePct}%)
            </span>
          </div>
          <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:12,marginTop:6,flexWrap:'wrap'}}>
            <span style={{fontSize:13,color:'#cbd5e1'}}>{data.tradeDate}</span>
            <span style={{fontSize:13,color:'#cbd5e1',fontFamily:'monospace'}}>{nowClock}</span>
            {watchlist.find(w=>w.code===data.code)
              ? <button onClick={addWatch}
                  style={{fontSize:13,color:'var(--accent)',background:'var(--accent-a06)',border:'1px solid var(--accent-a30)',borderRadius:7,padding:'4px 12px',cursor:'pointer',fontWeight:700}}>
                  ✓ 觀察中
                </button>
              : <button onClick={addWatch}
                  style={{fontSize:14,color:'#050c1a',background:'var(--accent)',border:'none',borderRadius:7,padding:'5px 14px',cursor:'pointer',fontWeight:800,letterSpacing:'0.02em'}}>
                  ＋ 觀察清單
                </button>
            }
          </div>
        </div>

        <StatsPanel data={data}/>
        <WaterGauge data={data} gaugeW={gaugeW}/>

        <div className="glass p-4 mt-4" style={{fontSize:14,color:'#cbd5e1',lineHeight:1.8}}>
          <div style={{fontWeight:700,color:'var(--accent)',marginBottom:4,fontSize:15}}>水位計怎麼看</div>
          浮球 = 現價。上方紅區是壓力、下方綠區是支撐。<br/>
          浮球往上接近壓力 → 變綠＋亮燈，提醒可分批停利，越接近閃越快。<br/>
          浮球往下接近支撐 → 變紅＋亮燈，提醒可分批買進，越接近閃越快。<br/>
          壓力/支撐後的數字越大，代表那條線的能量越強（越難突破或支撐越穩）。
        </div>
      </>}
    </div>
  );
}

const _semaEl = document.getElementById('sema-root');
if (_semaEl) ReactDOM.createRoot(_semaEl).render(<SemaApp/>);
