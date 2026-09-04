import React from 'react';
import ReactDOM from 'react-dom/client';

(function () {
  const { useState, useEffect } = React;

  const HELP = {
    dashboard: {
      title: '個股儀表板',
      sections: [
        {
          heading: '搜尋與加入清單',
          items: [
            { term: '搜尋欄', desc: '輸入代碼按 Enter 或點「執行」，系統立即分析並自動加入觀察清單。台股只需輸入 4 碼數字（如 2330），系統自動補上 .TW。' },
            { term: '↺ 重新整理', desc: '重新抓取觀察清單中所有股票的最新資料。' },
          ]
        },
        {
          heading: '訊號 Badge',
          items: [
            { term: '站穩多頭 / 持倉中', desc: '股價站穩於支撐均線上方，目前無急迫訊號。「持倉中」會同時顯示距上方壓力的百分比。' },
            { term: '接近壓力', desc: '股價距上方壓力均線不足 5%，注意隨時可能遇到阻力。' },
            { term: '接近支撐', desc: '股價距下方支撐均線不足 5%，可能是加碼參考區，也需留意若跌破則轉弱。' },
            { term: '突破確認中', desc: '剛突破壓力 3 或創近期新高，需觀察 3 日確認支撐是否有效，防假突破。' },
            { term: '海闊天空', desc: '上方已無任何壓力均線，多頭結構最強，但仍需留意乖離過大的風險。' },
            { term: '建議停利', desc: '股價已接近明顯壓力區或前高，停利訊號出現，建議分批考慮出場。' },
            { term: '注意訊號 / 出場訊號', desc: '出現爆天量見頂、急漲乖離過大等強烈警示，建議謹慎評估是否出場。' },
            { term: '跌破支撐 / 留意轉弱', desc: '股價已跌破支撐 3，趨勢可能轉弱，建議觀察是否有反彈機會再決策。' },
          ]
        },
        {
          heading: '展開水位計',
          items: [
            { term: '▼ 展開', desc: '點擊任一卡片展開完整水位計分析，包含 SEMA 均線支撐壓力圖、量能統計、詳細進出訊號。再點一次收合。' },
            { term: '上方綠框（停利訊號）', desc: '顯示壓力均線位置、前高壓力區、是否爆量見頂等，告訴你何時應考慮停利。' },
            { term: '下方紅框（支撐訊號）', desc: '顯示最近支撐均線與預估參考買點，以及籌碼沉澱的建倉時機。' },
            { term: '浮球顏色', desc: '藍色 = 距離壓力支撐都很遠，安全觀望；變綠 = 接近上方壓力，留意停利；變紅 = 接近下方支撐，留意風險。越接近閃爍越快。' },
          ]
        },
        {
          heading: 'SEMA 均線週期說明',
          items: [
            { term: '什麼是 SEMA？', desc: '本系統以費波那契數列（6、11、17、28、45…每項＝前兩項之和）為週期，建立 15 條均線，稱為 SEMA（Sunny EMA）。週期越短越靈敏，越長越穩定。' },
            { term: '支撐1　6日 EMA', desc: '極短線動能，約 1.5 週。反映最近幾日走勢，盤中快速反彈參考。' },
            { term: '支撐2　11日 EMA', desc: '短線趨勢，約 2.5 週。' },
            { term: '支撐3　17日 EMA ★核心', desc: '最重要的關鍵線，約 3.5 週（類 20 日線）。收盤站上 = 多方主控；連續跌破 = 出場訊號。系統所有警示都以此為基準。' },
            { term: '支撐4　28日 EMA', desc: '約 1.5 個月，月線級支撐。' },
            { term: '支撐5　45日 EMA', desc: '約 2 個月，接近季線。' },
            { term: '支撐6　72日 EMA', desc: '約 3.5 個月，季底支撐。' },
            { term: '支撐7　117日 EMA', desc: '約半年，半年線。' },
            { term: '支撐8　189日 EMA ★多空線', desc: '約 9 個月（類 200 日線）。此線向上 = 長線多頭趨勢健在；向下轉彎 = 多頭轉弱警示。' },
            { term: '支撐9　305日 EMA', desc: '約 1.5 年，長線趨勢均線。' },
            { term: '支撐10　494日 SMA', desc: '約 2 年，長期均線（切換為 SMA）。' },
            { term: '支撐11　799日 SMA ★大底', desc: '約 4 年。系統定義為「長線大底」（BIG_BRO），接近此線是逢低承接的長線參考區。' },
            { term: '支撐12　1292日 SMA', desc: '約 5 年。' },
            { term: '支撐13　2091日 SMA', desc: '約 8 年。' },
            { term: '支撐14　3383日 SMA', desc: '約 13 年。' },
            { term: '支撐15　5474日 SMA', desc: '約 21 年，超長線底部參考。' },
          ]
        },
        {
          heading: 'AI 報告按鈕',
          items: [
            { term: 'AI 報告 MM/DD', desc: '開啟此股票現有的分析報告。綠色 = 今日報告；琥珀色 = 舊報告（可考慮重新產生）。' },
            { term: '產生 AI 報告', desc: '送出分析請求，跳轉到 AI 報告頁，AI 約 1–3 分鐘完成深度報告。' },
          ]
        },
        {
          heading: '觀察清單管理',
          items: [
            { term: '自動加入', desc: '搜尋並分析任一股票後，若清單中沒有該股票，系統自動加入。' },
            { term: '× 移除', desc: '點卡片右上角的 × 即可移除。清單儲存在瀏覽器 localStorage，重新整理後仍保留。' },
          ]
        }
      ]
    },

    report: {
      title: 'AI 分析報告',
      sections: [
        {
          heading: '產生報告',
          items: [
            { term: '股票代碼輸入', desc: '美股：直接輸入代碼（如 AAPL、SMCI、NVDA）。台股：輸入 4 碼數字（如 2330），系統自動補上 .TW。' },
            { term: '產生 AI 分析報告', desc: '送出請求，AI 同時分析多時框技術面、法人籌碼、近期財報、產業競爭地位，約 1–3 分鐘完成。' },
            { term: '進度條', desc: '四個階段：送出 → 佇列等待 → 分析進行中 → 完成。完成後自動出現「開啟報告」按鈕。' },
          ]
        },
        {
          heading: '報告清單',
          items: [
            { term: '今日摘要', desc: '今日完成分析的股票卡片，包含 AI 產出的操作策略建議與盤勢展望。' },
            { term: '已有報告', desc: '歷史報告完整清單，點「開啟 →」閱讀 HTML 版完整報告，「PDF ↓」可下載存檔。' },
          ]
        }
      ]
    },

    screener: {
      title: '選股參考',
      sections: [
        {
          heading: 'RS Rating（相對強度）',
          items: [
            { term: 'RS Rating', desc: '0–99 分。衡量該股票過去 12 個月的價格漲幅相對於市場所有股票的百分位排名。RS 90 = 贏過市場上 90% 的股票。' },
            { term: '綠色 ≥ 90', desc: '極強勢股，動能頂尖 10%，是最值得關注的強勢標的。' },
            { term: '淺綠 ≥ 80', desc: '強勢股，達到篩選門檻（≥85），屬於本系統選股範圍。' },
            { term: '黃色 ≥ 70', desc: '中等，尚未達到強勢標準，可持續觀察是否持續升溫。' },
          ]
        },
        {
          heading: 'EPS（每股盈餘）',
          items: [
            { term: 'EPS YoY', desc: '最新季度 EPS 相較去年同期的成長率（Year over Year）。+25% 以上代表獲利強勁，是選股核心條件之一。' },
            { term: '↑ 加速成長', desc: 'EPS 成長率比上一季更高，代表獲利動能正在加速中，為特別強烈的正面訊號。' },
          ]
        },
        {
          heading: '個股訊號點（5 個）',
          items: [
            { term: 'RS≥85（藍點）', desc: 'RS Rating 達 85 以上，股票動能進入強勢區間。' },
            { term: 'EPS25（藍點）', desc: 'EPS 年成長率 ≥ 25%，獲利成長達到強勢標準。' },
            { term: 'EPS↑（藍點）', desc: 'EPS 成長加速，獲利動能持續增強中。' },
            { term: '近高（藍點）', desc: '股價接近 52 週高點或近期創 60 日新高，價格結構處於強勢位置。' },
            { term: '爆量（藍點）', desc: '今日成交量為 45 日均量的 1.5 倍以上，市場高度關注、資金湧入。' },
          ]
        },
        {
          heading: 'ETF（台股，代號旁有 ETF 標記）',
          items: [
            { term: '納入範圍', desc: '台股股票型 ETF，依成交金額取前 100（含槓桿型 00xxxL、主動式 00xxxA；排除反向、債券、期貨型）。' },
            { term: 'ETF 訊號（5 個）', desc: 'ETF 沒有 EPS，改用：RS≥85、近高、爆量、站均線（股價站上 SEMA3 持穩 ≥ 3 日）、SEMA上彎（SEMA1 + SEMA2 同時上彎）。命中 ≥ 2 個入選。' },
            { term: 'RS 獨立計算', desc: 'ETF 的 RS Rating 只跟其他 ETF 比，不與個股混在一起，避免大盤型 ETF 分數永遠中庸。' },
          ]
        },
        {
          heading: '殖利率（台股 / ETF）',
          items: [
            { term: '殖利率', desc: '近 12 個月現金配息加總 ÷ 目前股價。資料來源 FinMind，配息不足一個週期時以平均值 × 每年配息次數推估。' },
            { term: '配息頻率', desc: '月 / 雙月 / 季 / 半年 / 年，由歷次除息月份的間隔眾數推斷。' },
            { term: '顯示位置', desc: 'ETF 在「EPS/殖利」欄直接顯示殖利率；有配息的個股則在 EPS 下方附註「殖 X%」。槓桿型等不配息的 ETF 顯示「—」。' },
          ]
        },
        {
          heading: '如何解讀 & 使用',
          items: [
            { term: 'X/N 命中數', desc: '命中訊號越多，代表基本面 + 技術面 + 籌碼面越齊全，潛力越強（個股滿分 5、ETF 滿分 5）。灰點 = 未命中。' },
            { term: '點擊股票', desc: '點任一列就地展開明細：壓力／支撐位、量能統計、收盤位置、上方套牢區、各訊號命中狀況，台股／ETF 另有配息頻率與殖利率。再點一次收合。' },
            { term: '完整水位計 →', desc: '展開明細裡的按鈕，跳轉到個股水位計頁做完整分析。' },
            { term: '美股 / 台股切換', desc: '頁面上方可切換美股與台股兩個市場的掃描結果，各自獨立篩選。台股結果含 ETF。' },
            { term: '重新整理', desc: '選股掃描每日自動執行更新。如需取得最新資料，點右上角的↺重新整理。' },
          ]
        }
      ]
    }
  };

  function HelpDrawer() {
    const [open, setOpen] = useState(false);
    const [tab,  setTab]  = useState(window.__activeTab || 'dashboard');
    const [winW, setWinW] = useState(window.innerWidth);

    useEffect(() => {
      const onTabChange = e => setTab(e.detail);
      window.addEventListener('tabchange', onTabChange);
      return () => window.removeEventListener('tabchange', onTabChange);
    }, []);

    useEffect(() => {
      const onResize = () => setWinW(window.innerWidth);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, []);

    const content = HELP[tab];
    if (!content) return null;

    const isMobile = winW < 640;
    const drawerW  = isMobile ? winW - 16 : Math.min(420, winW - 48);

    return (
      <>
        {/* Drawer */}
        <div style={{
          position:'fixed', top:0, right:0, bottom:0, width:drawerW,
          background:'rgba(5,10,22,0.98)',
          borderLeft:'1px solid rgba(96,165,250,0.18)',
          boxShadow: open ? '-12px 0 48px rgba(0,0,0,0.7)' : 'none',
          zIndex:901,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          visibility: open ? 'visible' : 'hidden',
          transition: open
            ? 'transform 0.3s cubic-bezier(0.4,0,0.2,1), visibility 0s 0s'
            : 'transform 0.3s cubic-bezier(0.4,0,0.2,1), visibility 0s 0.3s',
          display:'flex', flexDirection:'column',
          overflowY:'auto',
        }}>
          {/* Drawer header */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'16px 20px',
            borderBottom:'1px solid rgba(96,165,250,0.12)',
            background:'rgba(8,17,38,0.95)',
            position:'sticky', top:0, zIndex:1,
            backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
          }}>
            <div>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.16em',
                           color:'#60a5fa',textTransform:'uppercase',marginBottom:3}}>
                使用說明
              </div>
              <div style={{fontSize:17,fontWeight:800,color:'#f1f5f9'}}>{content.title}</div>
            </div>
            <button onClick={() => setOpen(false)} style={{
              width:34,height:34,borderRadius:8,flexShrink:0,
              background:'rgba(255,255,255,0.05)',
              border:'1px solid rgba(255,255,255,0.1)',
              color:'#94a3b8',fontSize:20,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',
              transition:'background 0.15s',
            }}
            onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'}
            onMouseOut={e=>e.currentTarget.style.background='rgba(255,255,255,0.05)'}>
              ×
            </button>
          </div>

          {/* Drawer body */}
          <div style={{padding:'20px 20px 48px'}}>
            {content.sections.map((sec, si) => (
              <div key={si} style={{marginBottom:28}}>
                <div style={{
                  fontSize:13,fontWeight:700,letterSpacing:'0.08em',
                  color:'#94a3b8',textTransform:'uppercase',
                  paddingBottom:8,marginBottom:12,
                  borderBottom:'1px solid rgba(255,255,255,0.07)',
                }}>
                  {sec.heading}
                </div>
                {sec.items.map((item, ii) => (
                  <div key={ii} style={{
                    marginBottom:14,paddingLeft:10,
                    borderLeft:'2px solid rgba(96,165,250,0.25)',
                  }}>
                    <div style={{fontSize:13,fontWeight:800,color:'#93c5fd',marginBottom:3}}>
                      {item.term}
                    </div>
                    <div style={{fontSize:13,color:'#94a3b8',lineHeight:1.7}}>
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Floating ? button */}
        <button onClick={() => setOpen(o => !o)} title="使用說明" style={{
          position:'fixed', bottom: isMobile ? 20 : 28, right: isMobile ? 16 : 28,
          width: isMobile ? 42 : 46, height: isMobile ? 42 : 46, borderRadius:'50%',
          background: open
            ? 'rgba(96,165,250,0.15)'
            : 'linear-gradient(135deg,#1d4ed8,#3b82f6)',
          border: open ? '1px solid rgba(96,165,250,0.4)' : 'none',
          cursor:'pointer',
          fontSize:20,fontWeight:900,color:'#f1f5f9',
          boxShadow: 'none',
          display:'flex',alignItems:'center',justifyContent:'center',
          zIndex: open ? 902 : 800,
          transition:'all 0.2s',
        }}
        onMouseOver={e => { if (!open) e.currentTarget.style.transform='scale(1.1)'; }}
        onMouseOut={e => { e.currentTarget.style.transform='scale(1)'; }}>
          {open ? '×' : '?'}
        </button>
      </>
    );
  }

  ReactDOM.createRoot(document.getElementById('help-root')).render(
    React.createElement(HelpDrawer)
  );
})();
