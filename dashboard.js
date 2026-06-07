(function () {
  const { useState, useEffect, useRef, useCallback } = React;

  const _API = 'https://stock-tools.adelitwo.workers.dev';

  function _norm(raw) {
    const s = (raw || '').trim().toUpperCase();
    return /^\d{4}$/.test(s) ? s + '.TW' : s;
  }

  // ── 訊號 badge：從 data flags + dR/dS 推導，不 parse 文字 ──
  // topMsg = 壓力側（停利建議），botMsg = 支撐側（買進建議），兩者相反，
  // badge 只取最緊迫的那一側，用距離和 data flags 判斷。
  function getSignal(data, msgs) {
    const { topMsg, dR, dS } = msgs;

    // ⚠ 強制出場（clearOut / 爆天量見頂）
    if (topMsg.startsWith('⚠')) {
      if (topMsg.includes('出清') || topMsg.includes('全數停利'))
        return { color: '#f87171', bg: 'rgba(248,113,113,0.14)', border: 'rgba(248,113,113,0.35)', label: '出場訊號', dist: null };
      return { color: '#fb923c', bg: 'rgba(251,146,60,0.13)', border: 'rgba(251,146,60,0.32)', label: '注意訊號', dist: null };
    }

    // 跌破支撐 3（壓力側主導）
    if (data.belowSema3) {
      if (data.s1Down && data.s2Down)
        return { color: '#f87171', bg: 'rgba(248,113,113,0.14)', border: 'rgba(248,113,113,0.35)', label: '跌破支撐', dist: null };
      return { color: '#fb923c', bg: 'rgba(251,146,60,0.13)', border: 'rgba(251,146,60,0.32)', label: '留意轉弱', dist: null };
    }

    // 創近期新高（中性偏多，但需觀察）
    if (data.isNewHigh60)
      return { color: '#a78bfa', bg: 'rgba(167,139,250,0.09)', border: 'rgba(167,139,250,0.26)', label: '創近期新高', dist: null };

    // 突破壓力 3 確認中（aboveDays 1–3）
    if (data.aboveDays > 0 && data.aboveDays <= 3)
      return { color: '#a78bfa', bg: 'rgba(167,139,250,0.09)', border: 'rgba(167,139,250,0.26)', label: '突破確認中', dist: null };

    // 無上方壓力（海闊天空）
    const noResist = !(data.allSemas || data.semas || []).some(s => s.value >= data.price);
    if (noResist)
      return { color: '#4ade80', bg: 'rgba(74,222,128,0.09)', border: 'rgba(74,222,128,0.26)', label: '海闊天空', dist: null };

    // 以距離決定：哪側更緊迫就顯示哪側
    const nearR = dR < dS;
    if (nearR && dR < 5)
      return { color: '#facc15', bg: 'rgba(250,204,21,0.09)', border: 'rgba(250,204,21,0.26)', label: '接近壓力', dist: `+${dR.toFixed(1)}%` };
    if (!nearR && dS < 5)
      return { color: '#f87171', bg: 'rgba(248,113,113,0.11)', border: 'rgba(248,113,113,0.30)', label: '接近支撐', dist: `-${dS.toFixed(1)}%` };

    // 正常持倉區間：顯示離哪側近
    if (nearR)
      return { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.22)', label: '持倉中', dist: `距壓 ${dR.toFixed(1)}%` };
    return { color: '#4ade80', bg: 'rgba(74,222,128,0.09)', border: 'rgba(74,222,128,0.26)', label: '站穩多頭', dist: `距支 ${dS.toFixed(1)}%` };
  }

  // ── 緊湊卡片（可點選，展開後高亮） ──
  function StockCard({ sym, name, state, data, isSelected, onSelect, onRemove, reports, onGoReport }) {
    const dispSym = sym.replace(/\.TW$/i, '');
    const msgs    = data ? computeGaugeMessages(data) : null;
    const signal  = msgs ? getSignal(data, msgs) : null;
    const chg     = data?.change ?? 0;
    const chgColor = chg >= 0 ? '#ff5a5a' : '#33cc77';
    const [logoOk, setLogoOk] = useState(true);

    return (
      <div
        onClick={onSelect}
        style={{
          cursor: 'pointer',
          background: isSelected ? 'rgba(6,13,28,0.98)' : 'var(--bg-glass)',
          border: `1px solid ${isSelected ? 'rgba(96,165,250,0.52)' : 'rgba(96,165,250,0.22)'}`,
          borderRadius: 14,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: '12px 14px',
          position: 'relative',
          transition: 'border-color 0.18s, background 0.18s, box-shadow 0.18s',
          boxShadow: isSelected ? '0 0 0 1px rgba(96,165,250,0.10), 0 4px 24px rgba(96,165,250,0.08)' : 'none',
        }}
      >
        {/* 移除按鈕 */}
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 20, height: 20, borderRadius: '50%',
            background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.18)',
            color: '#f87171', fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0.6, transition: 'opacity 0.15s', lineHeight: 1, padding: 0,
          }}
          onMouseOver={e => e.currentTarget.style.opacity = '1'}
          onMouseOut={e => e.currentTarget.style.opacity = '0.6'}
        >×</button>

        {/* 股票 header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingRight: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            {logoOk && (
              <img
                src={`https://financialmodelingprep.com/image-stock/${sym}.png`}
                onError={() => setLogoOk(false)}
                style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, objectFit: 'contain' }}
              />
            )}
            <span style={{ fontSize: 16, fontWeight: 900, color: '#f1f5f9', flexShrink: 0 }}>{dispSym}</span>
            {(name || data?.name) && (
              <span style={{ fontSize: 11, color: '#7fa8d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name || data.name}
              </span>
            )}
          </div>
          {data && (() => {
            const ip = data.intraday_prices;
            const hasSpark = ip && ip.length > 1;
            const sparkSvg = hasSpark ? (() => {
              const w = 72, h = 28;
              const min = Math.min(...ip), max = Math.max(...ip), range = max - min || 1;
              const pts = ip.map((p, i) =>
                `${(i / (ip.length - 1) * w).toFixed(1)},${(h - (p - min) / range * h).toFixed(1)}`
              ).join(' ');
              const up = ip[ip.length - 1] >= ip[0];
              return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">` +
                `<polyline points="${pts}" fill="none" stroke="${up ? '#22c55e' : '#ef4444'}" stroke-width="1.5" stroke-linejoin="round"/>` +
                `</svg>`;
            })() : null;
            return (
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: chgColor, fontFamily: 'monospace' }}>
                    {data.price.toFixed(data.price < 50 ? 2 : 1)}
                  </span>
                  <span style={{ fontSize: 11, color: chgColor, marginLeft: 3 }}>
                    {chg >= 0 ? '+' : ''}{data.changePct}%
                  </span>
                </div>
                {sparkSvg && (
                  <div>
                    <div dangerouslySetInnerHTML={{ __html: sparkSvg }} />
                    <div style={{ fontSize: 10, color: '#64748b', textAlign: 'right', letterSpacing: '0.04em' }}>TODAY 5m</div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* 載入中 */}
        {state === 'loading' && (
          <div style={{ height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span className="sema-spinner" />
            <span style={{ fontSize: 12, color: '#7fa8d0' }}>載入中...</span>
          </div>
        )}

        {/* 失敗 */}
        {state === 'error' && (
          <div style={{ height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#f87171' }}>
            載入失敗
          </div>
        )}

        {/* 資料就緒 */}
        {state === 'done' && data && msgs && signal && (
          <>
            <PriceRail data={data} />

            {/* signal badge */}
            <div style={{ marginTop: 5, marginBottom: 8 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 20,
                background: signal.bg, border: `1px solid ${signal.border}`,
              }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: signal.color }}>{signal.label}</span>
                {signal.dist && (
                  <span style={{ fontSize: 10.5, color: signal.color, opacity: 0.75 }}>{signal.dist}</span>
                )}
              </div>
            </div>

            {/* 按鈕列：AI 報告 + 產生 + 展開/收合 */}
            {(() => {
              const dispSym  = sym.replace(/\.TW$/i, '');
              const isTW     = sym.toUpperCase().endsWith('.TW');
              const match    = reports?.find(r => r.symbol.toUpperCase().replace(/\.TW$/i, '') === dispSym.toUpperCase());
              const isCurrent = isReportCurrent(match?.date, isTW);
              const fmtDate  = d => { const p = (d || '').split('-'); return p.length === 3 ? `${p[1]}/${p[2]}` : d; };
              const showReport = match?.html_link && isCurrent;
              const cols = showReport ? '1fr 1fr 1fr' : '1fr 1fr';
              const btnStyle = {
                padding: '7px 4px', borderRadius: 7, fontSize: 11, fontWeight: 800,
                border: 'none', cursor: 'pointer', color: '#050c1a', lineHeight: 1.3,
              };
              return (
                <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 6 }} onClick={e => e.stopPropagation()}>
                  {showReport && (
                    <button
                      onClick={() => window.open(match.html_link, '_blank')}
                      style={{ ...btnStyle, background: 'linear-gradient(135deg,#15803d,#4ade80)' }}
                    >
                      AI 報告<br />{fmtDate(match.date)}
                    </button>
                  )}
                  <button
                    onClick={() => onGoReport(dispSym)}
                    style={{ ...btnStyle, background: 'linear-gradient(135deg,#2563eb,#93c5fd)' }}
                  >
                    產生<br />AI 報告
                  </button>
                  <button
                    onClick={() => onSelect()}
                    style={{ ...btnStyle, background: isSelected ? 'linear-gradient(135deg,#4b5563,#9ca3af)' : 'linear-gradient(135deg,#1e3a5f,#60a5fa)' }}
                  >
                    {isSelected ? '關閉水位計' : '水位計'}
                  </button>
                </div>
              );
            })()}
          </>
        )}
      </div>
    );
  }

  // ── 展開的詳細分析面板（完整水位計） ──
  function StockDetail({ data, reports, gaugeW, onGoReport }) {
    const dispSym   = data.code.replace(/\.TW$/i, '');
    const isTW      = data.code.toUpperCase().endsWith('.TW');
    const match     = reports?.find(r => r.symbol.toUpperCase().replace(/\.TW$/i, '') === dispSym.toUpperCase());
    const isCurrent = isReportCurrent(match?.date, isTW);
    const showReport = match?.html_link && isCurrent;

    return (
      <div style={{
        border: '1px solid rgba(96,165,250,0.30)',
        borderRadius: 16,
        background: 'rgba(5,11,24,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '16px 16px 20px',
      }}>
        {/* 詳細 header */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 10px', marginBottom: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: '#f1f5f9' }}>{dispSym}</span>
          <span style={{ fontSize: 13, color: '#7fa8d0' }}>{data.name}</span>
          <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: data.change >= 0 ? '#ff5a5a' : '#33cc77', marginLeft: 4 }}>
            {data.price.toFixed(data.price < 50 ? 2 : 1)}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: data.change >= 0 ? '#ff5a5a' : '#33cc77' }}>
            {data.change >= 0 ? '+' : ''}{data.change} ({data.change >= 0 ? '+' : ''}{data.changePct}%)
          </span>
        </div>

        <WaterGauge data={data} gaugeW={gaugeW} />

        <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.12)', fontSize: 13, color: '#cbd5e1', lineHeight: 1.8 }}>
          <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4, fontSize: 14 }}>水位計怎麼看</div>
          浮球 = 現價。上方紅區是壓力、下方綠區是支撐。<br />
          浮球往上接近壓力 → 變綠＋亮燈，提醒可分批停利，越接近閃越快。<br />
          浮球往下接近支撐 → 變紅＋亮燈，提醒可分批買進，越接近閃越快。<br />
          壓力/支撐後的數字越大，代表那條線的能量越強（越難突破或支撐越穩）。
        </div>
      </div>
    );
  }

  // ── 主頁面 ──
  function StocksPage() {
    // 合併舊 watchlist：sema_watchlist [{code,name}]、dash_watchlist [string]
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
    const [selectedSym, setSelectedSym] = useState(null);
    const [reports,     setReports]     = useState([]);
    const [gaugeW,      setGaugeW]      = useState(140);

    const containerRef = useRef(null);
    const detailRef    = useRef(null);

    // 儲存統一 watchlist，清除舊 key
    useEffect(() => {
      localStorage.setItem('watchlist', JSON.stringify(watchlist));
      localStorage.removeItem('dash_watchlist');
      localStorage.removeItem('sema_watchlist');
    }, [watchlist]);

    // 水位計寬度自適應
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const ro = new ResizeObserver(([e]) => {
        setGaugeW(Math.round(Math.max(140, Math.min(240, e.contentRect.width * 0.38))));
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    // 載入報告清單
    useEffect(() => {
      fetch(`${_API}/reports`)
        .then(r => r.json())
        .then(d => setReports(d.reports || []))
        .catch(() => {});
    }, []);

    // 批次載入 watchlist 資料
    const loadBatch = useCallback(() => {
      if (!watchlist.length) { setBatchState('done'); return; }
      setBatchState('loading');
      window.fetchSemaBatch(watchlist.map(w => _norm(w.code)))
        .then(map => { setBatchData(map); setBatchState('done'); })
        .catch(() => setBatchState('error'));
    }, [watchlist]);

    useEffect(() => { loadBatch(); }, [loadBatch]);

    // 單支股票分析（搜尋欄觸發）
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
        setSelectedSym(json.code);
        setSysMsg(`${json.name} 分析完成 ✓`);
      } catch (e) {
        setSysMsg(`分析失敗：${e.message}`);
      } finally {
        setLoading(false);
      }
    }, [input]);

    // 注册全域 quickSema（sidebar 快速分析按鈕使用）
    useEffect(() => {
      window.quickSema = code => {
        const norm = _norm(code);
        showTab('dashboard');
        setInput(norm);
        analyze(norm);
      };
      return () => { delete window.quickSema; };
    }, [analyze]);

    const handleSelect = sym => {
      setSelectedSym(prev => {
        const next = prev === sym ? null : sym;
        return next;
      });
    };

    const handleRemove = sym => {
      setWatchlist(prev => prev.filter(w => _norm(w.code) !== sym));
      if (selectedSym === sym) setSelectedSym(null);
    };

    const handleGoReport = dispSym => {
      document.getElementById('symbol').value = dispSym;
      showTab('report');
    };

    const selectedData = selectedSym ? batchData[selectedSym] : null;

    return (
      <div ref={containerRef}>

        {/* ── 搜尋欄 ── */}
        <div className="glass" style={{ padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="field"
              style={{ flex: 1, marginBottom: 0 }}
              value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && analyze()}
              placeholder="輸入代碼分析或加入清單  AAPL / 2330"
              maxLength={10}
            />
            <button
              onClick={() => analyze()}
              disabled={loading}
              className="btn-gold"
              style={{ width: 'auto', padding: '12px 20px' }}
            >
              {loading ? '分析中...' : '執行'}
            </button>
            <button
              onClick={loadBatch}
              title="重新整理"
              style={{
                flexShrink: 0, padding: '12px 14px', borderRadius: 10, fontSize: 16,
                color: '#7fa8d0', background: 'none',
                border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
              }}
            >↺</button>
          </div>
          {sysMsg && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1' }}>
              {loading && <span className="sema-spinner" />}
              <span>{sysMsg}</span>
            </div>
          )}
        </div>

        {/* ── 空白提示 ── */}
        {watchlist.length === 0 && (
          <div style={{ textAlign: 'center', color: '#7fa8d0', fontSize: 14, lineHeight: 2.3, padding: '48px 0' }}>
            觀察清單是空的<br />
            <span style={{ fontSize: 12, color: '#475569' }}>輸入代碼按「執行」，分析後自動加入清單</span>
          </div>
        )}

        {/* ── 卡片格線 ── */}
        {watchlist.length > 0 && (
          <div style={{
            display: 'grid', gap: 10,
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            marginBottom: selectedSym && selectedData && !selectedData.error ? 12 : 0,
          }}>
            {watchlist.map(w => {
              const norm      = _norm(w.code);
              const cardData  = batchData[norm];
              const cardState = batchState === 'done' ? (cardData?.error ? 'error' : 'done') : batchState;
              return (
                <StockCard
                  key={w.code}
                  sym={norm}
                  name={w.name || cardData?.name || ''}
                  state={cardState}
                  data={cardData?.error ? null : cardData}
                  isSelected={selectedSym === norm}
                  onSelect={() => handleSelect(norm)}
                  onRemove={() => handleRemove(norm)}
                  reports={reports}
                  onGoReport={handleGoReport}
                />
              );
            })}
          </div>
        )}

        {/* ── 詳細分析面板 ── */}
        {selectedSym && selectedData && !selectedData.error && (
          <div ref={detailRef} style={{ scrollMarginTop: 16 }}>
            <StockDetail
              data={selectedData}
              reports={reports}
              gaugeW={gaugeW}
              onGoReport={handleGoReport}
            />
          </div>
        )}

      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById('dashboard-root')).render(
    React.createElement(StocksPage)
  );
})();
