import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Papa from 'papaparse';
import { fetchSnapshot, fetchHistoricalRanking, showToast } from './src/api.js';
import { updateTableDelta, triggerFlashIfChanged } from './src/ui.js';

Chart.register(ChartDataLabels);

// ============================================================
// STATE
// ============================================================
let allStocks = [];
let allMarketData = [];
let sectorRankingData = [];
let themeRankingData = [];
let chartInstance = null;
let currentSector = null;
let currentChartMode = 'sector';
let currentPeriodDays = 1;
let currentDetailSort = { column: 'amount', order: 'desc' };
let globalSectorDataForTable = [];
let historicalRanking = null; // Pre-calculated 5/10/20 day ranking data
let liveSnapshotCache = {}; // Latest live market cache
let isMarketOpenNow = false;

// Race condition prevention
let currentFetchId = 0;
// Per-sector historical cache for chart view
const historicalDataCache = {};

// Sorting states
let sortCol = 'amount', sortDesc = true;
let currentRadarData = []; // Holds the current radar data (live or historical) for re-sorting
let radarSortCol = 'amount', radarSortDesc = true;
let themeSortCol = 'amount', themeSortDesc = true;

// ============================================================
// DOM ELEMENTS
// ============================================================
const viewRanking = document.getElementById('view-ranking');
const viewThemeRanking = document.getElementById('view-theme-ranking');
const viewRadar = document.getElementById('view-radar');
const viewChart = document.getElementById('view-chart');
const rankingTableBody = document.getElementById('rankingTableBody');
const themeRankingTableBody = document.getElementById('themeRankingTableBody');
const radarTableBody = document.getElementById('radarTableBody');
const currentSectorTitle = document.getElementById('current-sector-title');
const canvas = document.getElementById('bubbleChart');
const backBtn = document.getElementById('back-btn');
const sortableHeaders = document.querySelectorAll('.ranking-table th.sortable:not(.radar-sortable):not(.theme-sortable)');
const themeSortableHeaders = document.querySelectorAll('.theme-sortable');
const radarSortableHeaders = document.querySelectorAll('.radar-sortable');
const navBtns = document.querySelectorAll('.nav-btn');

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global Error:', message, error);
};
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled rejection:', event.reason);
});

// ============================================================
// INIT
// ============================================================
async function init() {
  try {
    // Load historical ranking JSON first (pre-calculated 5/10/20 day data)
    historicalRanking = await fetchHistoricalRanking();
    if (historicalRanking) {
      const updatedAt = historicalRanking.updated_at
        ? new Date(historicalRanking.updated_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
        : '未知';
      console.log(`[HistoricalRanking] Loaded. Updated at: ${updatedAt}`);
    } else {
      console.warn('[HistoricalRanking] Not available, 5/10/20 day ranking will be disabled.');
    }

    // Load CSV
    const todayStr = new Date().toISOString().split('T')[0];
    Papa.parse(`./stocks.csv?v=${todayStr}`, {
      download: true,
      header: true,
      complete: function(results) {
        allStocks = results.data.filter(d => d['股票代號'] && d['股票名稱']);
        // Initial data fetch
        processData();
      }
    });

    // ---- Navigation ----
    navBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        navBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const targetViewId = e.target.getAttribute('data-target');
        switchView(targetViewId);
        if (targetViewId !== 'view-chart') currentSector = null;
      });
    });

    backBtn.addEventListener('click', () => {
      const activeNav = document.querySelector('.nav-btn.active') || navBtns[0];
      switchView(activeNav.getAttribute('data-target'));
      currentSector = null;
      
      // When going back, re-render the view with the correct historical or live data
      if (currentPeriodDays === 1) {
        if (activeNav.getAttribute('data-target') === 'view-ranking') renderRanking();
        else if (activeNav.getAttribute('data-target') === 'view-theme-ranking') renderThemeRanking();
        else if (activeNav.getAttribute('data-target') === 'view-radar') renderRadar();
      } else {
        renderHistoricalRanking(currentPeriodDays);
      }
    });

    sortableHeaders.forEach(h => {
      h.addEventListener('click', () => {
        const col = h.getAttribute('data-sort');
        if (sortCol === col) sortDesc = !sortDesc; else { sortCol = col; sortDesc = true; }
        updateSortUI();
        if (currentPeriodDays === 1) {
          renderRanking();
        } else {
          renderHistoricalRanking(currentPeriodDays);
        }
      });
    });

    themeSortableHeaders.forEach(h => {
      h.addEventListener('click', () => {
        const col = h.getAttribute('data-sort');
        if (themeSortCol === col) themeSortDesc = !themeSortDesc; else { themeSortCol = col; themeSortDesc = true; }
        updateThemeSortUI();
        if (currentPeriodDays === 1) {
          renderThemeRanking();
        } else {
          renderHistoricalRanking(currentPeriodDays);
        }
      });
    });

    radarSortableHeaders.forEach(h => {
      h.addEventListener('click', () => {
        const col = h.getAttribute('data-sort');
        if (radarSortCol === col) radarSortDesc = !radarSortDesc; else { radarSortCol = col; radarSortDesc = true; }
        updateRadarSortUI();
        // In historical mode, resort the cached radar data; in live mode, re-render from allMarketData
        if (currentPeriodDays !== 1 && currentRadarData.length > 0) {
          resortRadar();
        } else {
          renderRadar();
        }
      });
    });

    // ---- Period buttons (main page ranking) ----
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', debounceUI((e) => {
        const days = parseInt(e.target.getAttribute('data-period'));
        if (currentPeriodDays === days) return;
        currentPeriodDays = days;
        
        // Update all period selectors to keep them in sync
        document.querySelectorAll('.period-btn').forEach(b => {
          if (parseInt(b.getAttribute('data-period')) === days) b.classList.add('active');
          else b.classList.remove('active');
        });

        // If in chart view: re-render chart
        if (!viewChart.classList.contains('hidden') && currentSector) {
          renderChart(currentSector, currentChartMode);
          return;
        }
        
        // Otherwise: re-render main ranking tables with period data
        if (currentPeriodDays === 1) {
          if (document.getElementById('view-ranking').classList.contains('active')) renderRanking();
          if (document.getElementById('view-theme-ranking').classList.contains('active')) renderThemeRanking();
          if (document.getElementById('view-radar').classList.contains('active')) renderRadar();
        } else {
          renderHistoricalRanking(currentPeriodDays);
        }
      }, 50));
    });

    // ---- Detail table sorting (chart view) ----
    document.querySelectorAll('.detail-sortable').forEach(th => {
      th.addEventListener('click', () => {
        const column = th.getAttribute('data-sort');
        if (currentDetailSort.column === column) {
          currentDetailSort.order = currentDetailSort.order === 'desc' ? 'asc' : 'desc';
        } else {
          currentDetailSort.column = column;
          currentDetailSort.order = 'desc';
        }
        document.querySelectorAll('.detail-sortable .sort-icon').forEach(i => { i.textContent = ''; i.classList.remove('asc', 'desc'); });
        const icon = document.getElementById(`detail-sort-${column}`);
        if (icon) { icon.textContent = currentDetailSort.order === 'desc' ? '▼' : '▲'; icon.classList.add(currentDetailSort.order); }
        if (globalSectorDataForTable.length > 0) renderDetailTable(globalSectorDataForTable);
      });
    });

    // ---- UI init ----
    updateSortUI();
    updateThemeSortUI();
    updateRadarSortUI();

    // ---- Auto-refresh (live snapshot every 15 seconds) ----
    setInterval(() => {
      if (currentPeriodDays === 1) {
        processData(true); // silent refresh (no loading indicator)
      }
    }, 15000);

  } catch (error) {
    console.error('Init failed:', error);
  }
}

// ============================================================
// DATA PROCESSING - LIVE SNAPSHOT
// ============================================================
async function processData(silent = false) {
  try {
    const result = await fetchSnapshot(allStocks);
    if (!result) return; // Exit if fetch failed, keeping previous data
    
    const marketCache = result.data || result;
    isMarketOpenNow = result.isMarketOpen !== undefined ? result.isMarketOpen : true;
    liveSnapshotCache = marketCache;

    // Update timestamp
    const now = new Date();
    const marketStatus = isMarketOpenNow ? ' 🟢 盤中即時' : ' 🔴 已收盤';
    document.getElementById('last-updated').textContent =
      `最後更新：${now.toLocaleTimeString('zh-TW', { hour12: false })}${marketStatus}`;

    // Build allMarketData from CSV + snapshot
    const sectors = new Set();
    allMarketData = allStocks.map(stock => {
      const symbol = stock['股票代號'];
      let dailyReturn = 0, volume = 0, amount = 0, price = 0;
      if (marketCache[symbol]) {
        const data = marketCache[symbol];
        price = data.price || 0;
        volume = data.volume || 0;
        if (data.prevClose && data.prevClose > 0 && price > 0) {
          dailyReturn = ((price - data.prevClose) / data.prevClose) * 100;
        }
        amount = price * volume * 1000;
      }
      if (stock['產業別'] && stock['產業別'] !== '無' && stock['產業別'] !== '') sectors.add(stock['產業別']);
      return { stock, dailyReturn, volume, amount, price };
    });

    // Aggregate sector ranking
    const sectorMap = {}, themeMap = {};
    const blacklist = ['半導體', '電子零組件', '電子代工', '通信網路', '其他電子', '光電', '電腦及週邊設備'];

    allMarketData.forEach(d => {
      const sector = d.stock['產業別'];
      if (sector && sector !== '無' && sector !== '') {
        if (!sectorMap[sector]) sectorMap[sector] = { sector, totalVolume: 0, totalAmount: 0, weightedReturnSum: 0, count: 0 };
        sectorMap[sector].totalVolume += d.volume;
        sectorMap[sector].totalAmount += d.amount;
        sectorMap[sector].weightedReturnSum += (d.dailyReturn * d.amount);
        sectorMap[sector].count += 1;
      }
      const themesStr = d.stock['題材清單'];
      if (themesStr) {
        themesStr.split('、').map(t => t.trim())
          .filter(t => t.length > 0 && t !== sector && !blacklist.includes(t))
          .forEach(theme => {
            if (!themeMap[theme]) themeMap[theme] = { theme, totalVolume: 0, totalAmount: 0, weightedReturnSum: 0, count: 0 };
            themeMap[theme].totalVolume += d.volume;
            themeMap[theme].totalAmount += d.amount;
            themeMap[theme].weightedReturnSum += (d.dailyReturn * d.amount);
            themeMap[theme].count += 1;
          });
      }
    });

    sectorRankingData = Object.values(sectorMap).map(s => ({
      sector: s.sector, totalVolume: s.totalVolume, totalAmount: s.totalAmount,
      avgReturn: s.totalAmount > 0 ? s.weightedReturnSum / s.totalAmount : 0
    }));

    themeRankingData = Object.values(themeMap).map(t => ({
      theme: t.theme, totalVolume: t.totalVolume, totalAmount: t.totalAmount,
      avgReturn: t.totalAmount > 0 ? t.weightedReturnSum / t.totalAmount : 0
    }));

    // Only render main ranking if we're in period=1 mode
    if (currentPeriodDays === 1) {
      renderRanking();
      renderThemeRanking();
      renderRadar();
    }

    // If chart view is open, auto-refresh chart (single day mode only)
    if (currentSector && !viewChart.classList.contains('hidden') && currentPeriodDays === 1) {
      renderChart(currentSector, currentChartMode);
    }

  } catch (error) {
    console.error('processData error:', error);
    document.getElementById('last-updated').textContent = '最後更新：載入失敗，請稍後再試。';
  }
}

// ============================================================
// RENDER HISTORICAL RANKING (5/10/20 days from pre-calc JSON)
// ============================================================
function renderHistoricalRanking(days) {
  if (!historicalRanking || !historicalRanking[String(days)]) {
    rankingTableBody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:#94a3b8">歷史資料尚未產生，請稍後再試</td></tr>`;
    themeRankingTableBody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:#94a3b8">歷史資料尚未產生</td></tr>`;
    return;
  }

  const periodData = historicalRanking[String(days)];
  const updatedAt = historicalRanking.updated_at
    ? new Date(historicalRanking.updated_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
    : '';

  // Temporarily override with historical data for rendering
  const origSector = [...sectorRankingData];
  const origTheme = [...themeRankingData];
  const origMarket = [...allMarketData];

  sectorRankingData = periodData.sectors.filter(s => isFinite(s.avgReturn));
  themeRankingData = periodData.themes.filter(t => isFinite(t.avgReturn));

  renderRanking(`近 ${days} 日排行 (更新: ${updatedAt})`);
  renderThemeRanking(`近 ${days} 日排行`);
    
  const desc = document.getElementById('radar-description');
  if (desc) desc.textContent = `顯示全市場近 ${days} 日累積成交金額最高的前 200 檔個股`;

  // Radar: store historical radar data and render with current sort
  currentRadarData = periodData.radar || [];
  resortRadar();

  // Restore
  sectorRankingData = origSector;
  themeRankingData = origTheme;
}

// ============================================================
// RENDER RANKING TABLE
// ============================================================
function renderRanking(subTitle = '') {
  const desc = document.getElementById('ranking-description');
  if (desc) {
    desc.textContent = subTitle ? subTitle : '點擊各產業別標籤即可查看該族群的泡泡圖分析';
  }

  let data = [...sectorRankingData];
  data.sort((a, b) => {
    const vA = sortCol === 'amount' ? a.totalAmount : sortCol === 'volume' ? a.totalVolume : a.avgReturn;
    const vB = sortCol === 'amount' ? b.totalAmount : sortCol === 'volume' ? b.totalVolume : b.avgReturn;
    return sortDesc ? vB - vA : vA - vB;
  });

  const maxAmount = Math.max(...data.map(d => d.totalAmount), 1);
  const maxReturn = Math.max(...data.map(d => Math.abs(d.avgReturn)), 1);

  updateTableDelta(
    rankingTableBody,
    data,
    (d) => d.sector, // getRowId
    (tr, d, index) => { // updateRow
      const returnClass = d.avgReturn > 0 ? 'color-positive' : (d.avgReturn < 0 ? 'color-negative' : '');
      const returnSign = d.avgReturn > 0 ? '+' : '';
      const amountStr = (d.totalAmount / 100000000).toFixed(2);
      const amountPct = (d.totalAmount / maxAmount) * 100;
      const returnPct = (Math.abs(d.avgReturn) / maxReturn) * 100;
      const returnBarColor = d.avgReturn >= 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';

      const oldAmount = tr.getAttribute('data-amount');
      
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td><span class="badge-sector">${d.sector}</span></td>
        <td class="text-right ${returnClass} data-bar-cell">
          <div class="data-bar" style="width:${returnPct}%;background:${returnBarColor}"></div>
          <strong class="data-bar-text">${returnSign}${d.avgReturn.toFixed(2)}%</strong>
        </td>
        <td class="text-right">${Math.round(d.totalVolume).toLocaleString()}</td>
        <td class="text-right data-bar-cell">
          <div class="data-bar" style="width:${amountPct}%;background:rgba(56,189,248,0.15)"></div>
          <span class="data-bar-text">${amountStr}</span>
        </td>
      `;
      
      if (!tr.hasAttribute('data-amount')) {
         tr.addEventListener('click', () => showChart(d.sector, 'sector'));
      }

      tr.setAttribute('data-amount', d.totalAmount);
      triggerFlashIfChanged(tr, oldAmount, d.totalAmount);
    }
  );
}

// ============================================================
// RENDER THEME RANKING TABLE
// ============================================================
function renderThemeRanking(subTitle = '') {
  const desc = document.getElementById('theme-ranking-description');
  if (desc) {
    desc.textContent = subTitle ? subTitle : '點擊各題材類別標籤即可查看該概念股的專屬泡泡圖';
  }

  let data = [...themeRankingData];
  data.sort((a, b) => {
    const vA = themeSortCol === 'amount' ? a.totalAmount : themeSortCol === 'volume' ? a.totalVolume : a.avgReturn;
    const vB = themeSortCol === 'amount' ? b.totalAmount : themeSortCol === 'volume' ? b.totalVolume : b.avgReturn;
    return themeSortDesc ? vB - vA : vA - vB;
  });

  const maxAmount = Math.max(...data.map(d => d.totalAmount), 1);
  const maxReturn = Math.max(...data.map(d => Math.abs(d.avgReturn)), 1);

  updateTableDelta(
    themeRankingTableBody,
    data,
    (d) => d.theme, // getRowId
    (tr, d, index) => { // updateRow
      const returnClass = d.avgReturn > 0 ? 'color-positive' : (d.avgReturn < 0 ? 'color-negative' : '');
      const returnSign = d.avgReturn > 0 ? '+' : '';
      const amountStr = (d.totalAmount / 100000000).toFixed(2);
      const amountPct = (d.totalAmount / maxAmount) * 100;
      const returnPct = (Math.abs(d.avgReturn) / maxReturn) * 100;
      const returnBarColor = d.avgReturn >= 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';
      
      const oldAmount = tr.getAttribute('data-amount');

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td><span class="badge-sector">${d.theme}</span></td>
        <td class="text-right ${returnClass} data-bar-cell">
          <div class="data-bar" style="width:${returnPct}%;background:${returnBarColor}"></div>
          <strong class="data-bar-text">${returnSign}${d.avgReturn.toFixed(2)}%</strong>
        </td>
        <td class="text-right">${Math.round(d.totalVolume).toLocaleString()}</td>
        <td class="text-right data-bar-cell">
          <div class="data-bar" style="width:${amountPct}%;background:rgba(56,189,248,0.15)"></div>
          <span class="data-bar-text">${amountStr}</span>
        </td>
      `;
      
      if (!tr.hasAttribute('data-amount')) {
         tr.addEventListener('click', () => showChart(d.theme, 'theme'));
      }
      
      tr.setAttribute('data-amount', d.totalAmount);
      triggerFlashIfChanged(tr, oldAmount, d.totalAmount);
    }
  );
}

// ============================================================
// RENDER RADAR TABLE (live)
// ============================================================
function renderRadar() {
  const desc = document.getElementById('radar-description');
  if (desc) desc.textContent = `顯示全市場即時成交金額最高的前 100 檔個股`;

  // Build live data and store for sorting
  currentRadarData = [...allMarketData].filter(d => d.amount > 0);
  const sorted = [...currentRadarData]
    .sort((a, b) => {
      const vA = radarSortCol === 'amount' ? a.amount : radarSortCol === 'volume' ? a.volume : a.dailyReturn;
      const vB = radarSortCol === 'amount' ? b.amount : radarSortCol === 'volume' ? b.volume : b.dailyReturn;
      return radarSortDesc ? vB - vA : vA - vB;
    })
    .slice(0, 100);
  renderRadarFromData(sorted, '今日');
}

// ============================================================
// RENDER RADAR TABLE (sorting re-entry for historical mode)
// ============================================================
function resortRadar() {
  if (currentRadarData.length === 0) return;
  const sorted = [...currentRadarData]
    .sort((a, b) => {
      const vA = radarSortCol === 'amount' ? a.amount : radarSortCol === 'volume' ? a.volume : a.dailyReturn;
      const vB = radarSortCol === 'amount' ? b.amount : radarSortCol === 'volume' ? b.volume : b.dailyReturn;
      return radarSortDesc ? vB - vA : vA - vB;
    })
    .slice(0, 200);
  renderRadarFromData(sorted);
}

// ============================================================
// RENDER RADAR TABLE (from any data source)
// ============================================================
function renderRadarFromData(stocks, periodLabel = '') {
  if (!stocks || stocks.length === 0) {
    radarTableBody.innerHTML = '<tr><td colspan="6" class="text-center">查無交易資料</td></tr>';
    return;
  }

  const maxAmount = Math.max(...stocks.map(s => s.amount), 1);
  const maxReturn = Math.max(...stocks.map(s => {
    let r = parseFloat(s.dailyReturn);
    return (isNaN(r) || !isFinite(r)) ? 0 : Math.abs(r);
  }), 1);

  updateTableDelta(
    radarTableBody,
    stocks,
    (stock) => stock.stock ? stock.stock['股票代號'] : (stock.symbol || ''), // getRowId
    (tr, stock, index) => { // updateRow
      let ret = parseFloat(stock.dailyReturn);
      if (isNaN(ret) || !isFinite(ret)) ret = 0;
      
      const returnClass = ret > 0 ? 'color-positive' : (ret < 0 ? 'color-negative' : '');
      const returnSign = ret > 0 ? '+' : '';
      const amountStr = (stock.amount / 100000000).toFixed(2);
      const amountPct = (stock.amount / maxAmount) * 100;
      const returnPct = (Math.abs(ret) / maxReturn) * 100;
      const returnBarColor = ret >= 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';

      const stockName = stock.stock ? stock.stock['股票名稱'] : (stock.name || '');
      const stockCode = stock.stock ? stock.stock['股票代號'] : (stock.symbol || '');
      const stockSector = stock.stock ? stock.stock['產業別'] : '';

      const oldAmount = tr.getAttribute('data-amount');

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${stockName} <span style="font-size:0.9em;color:var(--text-secondary)">${stockCode}</span></td>
        <td class="text-right"><span class="badge-sector">${stockSector}</span></td>
        <td class="text-right ${returnClass} data-bar-cell">
          <div class="data-bar" style="width:${returnPct}%;background:${returnBarColor}"></div>
          <strong class="data-bar-text">${returnSign}${ret.toFixed(2)}%</strong>
        </td>
        <td class="text-right">${Math.round(stock.volume).toLocaleString()}</td>
        <td class="text-right data-bar-cell">
          <div class="data-bar" style="width:${amountPct}%;background:rgba(56,189,248,0.15)"></div>
          <span class="data-bar-text">${amountStr}</span>
        </td>
      `;

      if (!tr.hasAttribute('data-amount')) {
         tr.addEventListener('click', () => {
           if (stockSector) showChart(stockSector, 'sector');
         });
      }

      tr.setAttribute('data-amount', stock.amount || 0);
      triggerFlashIfChanged(tr, oldAmount, stock.amount || 0);
    }
  );
}



// ============================================================
// SORT UI UPDATERS
// ============================================================
function updateSortUI() {
  sortableHeaders.forEach(h => {
    const col = h.getAttribute('data-sort');
    const icon = h.querySelector('.sort-icon');
    if (col === sortCol) { h.setAttribute('data-active', 'true'); icon.textContent = sortDesc ? '▼' : '▲'; }
    else { h.removeAttribute('data-active'); icon.textContent = ''; }
  });
}
function updateThemeSortUI() {
  themeSortableHeaders.forEach(h => {
    const col = h.getAttribute('data-sort');
    const icon = h.querySelector('.sort-icon');
    if (col === themeSortCol) { h.setAttribute('data-active', 'true'); icon.textContent = themeSortDesc ? '▼' : '▲'; }
    else { h.removeAttribute('data-active'); icon.textContent = ''; }
  });
}
function updateRadarSortUI() {
  radarSortableHeaders.forEach(h => {
    const col = h.getAttribute('data-sort');
    const icon = h.querySelector('.sort-icon');
    if (col === radarSortCol) { h.setAttribute('data-active', 'true'); icon.textContent = radarSortDesc ? '▼' : '▲'; }
    else { h.removeAttribute('data-active'); icon.textContent = ''; }
  });
}

// ============================================================
// SWITCH VIEW
// ============================================================
function switchView(targetViewId) {
  if (targetViewId !== 'view-chart') {
    navBtns.forEach(b => {
      if (b.getAttribute('data-target') === targetViewId) b.classList.add('active');
      else b.classList.remove('active');
    });
  }
  [viewRanking, viewThemeRanking, viewRadar, viewChart].forEach(v => {
    v.classList.add('hidden'); v.classList.remove('active');
  });
  const target = document.getElementById(targetViewId);
  if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
}

// ============================================================
// SHOW CHART (entry point)
// ============================================================
function showChart(identifier, mode = 'sector') {
  currentSector = identifier;
  currentChartMode = mode;
  switchView('view-chart');

  const modeText = mode === 'sector' ? '族群' : '題材概念';
  currentSectorTitle.textContent = `${identifier} ${modeText}分析`;

  renderChart(identifier, mode);
}

// ============================================================
// RENDER CHART
// ============================================================
async function renderChart(identifier, mode) {
  currentFetchId++;
  const fetchId = currentFetchId;

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  const modeText = mode === 'sector' ? '族群' : '題材';
  currentSectorTitle.textContent = `${identifier} ${modeText}分析`;

  // Filter stocks
  let baseData = mode === 'sector'
    ? allMarketData.filter(d => d.stock['產業別'] === identifier)
    : allMarketData.filter(d => {
        const themes = d.stock['題材清單'];
        return themes && themes.includes(identifier);
      });

  // Safety filter: only stocks with valid data
  baseData = baseData.filter(d => d && d.stock && d.stock['股票代號'] && d.amount > 0 && d.volume > 0 && isFinite(d.dailyReturn));
  baseData.sort((a, b) => b.amount - a.amount);
  baseData = baseData.slice(0, 50);

  if (baseData.length === 0) {
    currentSectorTitle.textContent = `${identifier} ${modeText}分析 (無資料)`;
    return;
  }

  const overlay = document.getElementById('chart-loading-overlay');
  let sectorData = [];

  if (currentPeriodDays === 1) {
    // --- LIVE SINGLE DAY ---
    overlay.classList.add('hidden');
    sectorData = baseData.map(d => ({
      symbol: d.stock['股票代號'],
      name: d.stock['股票名稱'],
      stock: d.stock,
      dailyReturn: d.dailyReturn || 0,
      volume: d.volume,
      amount: d.amount
    }));
  } else {
    // --- HISTORICAL PERIOD (From pre-calculated JSON) ---
    overlay.classList.add('hidden'); // No loading needed, data is already in memory

    if (!historicalRanking || !historicalRanking[String(currentPeriodDays)]) {
      currentSectorTitle.textContent = `${identifier} ${modeText}分析 (歷史資料缺失)`;
      return;
    }

    const periodData = historicalRanking[String(currentPeriodDays)].allStocks || historicalRanking[String(currentPeriodDays)].radar || [];
    
    // Create a map for fast lookup
    const periodMap = {};
    periodData.forEach(d => {
      periodMap[d.stock['股票代號']] = d;
    });

    for (const d of baseData) {
      const symbol = d.stock['股票代號'];
      if (periodMap[symbol]) {
        const p = periodMap[symbol];
        sectorData.push({
          symbol, name: d.stock['股票名稱'], stock: d.stock,
          dailyReturn: p.dailyReturn || 0,
          volume: p.volume,
          amount: p.amount
        });
      } else {
        sectorData.push({
          symbol, name: d.stock['股票名稱'], stock: d.stock,
          dailyReturn: 0, volume: 0, amount: 0, isMissing: true
        });
      }
    }

    sectorData.sort((a, b) => b.amount - a.amount);
    sectorData = sectorData.slice(0, 50);
    currentSectorTitle.textContent = `${identifier} ${modeText}分析 (近 ${currentPeriodDays} 日)`;
  }

  overlay.classList.add('hidden');

  // ---- CHART ----
  const chartPlotData = sectorData.filter(d => !d.isMissing && d.amount > 0);
  if (chartPlotData.length === 0) {
    currentSectorTitle.textContent += ' - 無圖表資料';
    globalSectorDataForTable = sectorData;
    renderDetailTable(sectorData);
    return;
  }

  const datasets = [{
    label: `${identifier} ${mode === 'sector' ? '族群' : '題材'}`,
    data: chartPlotData.map(d => ({
      x: Math.max((d.amount / 100000000) || 0.1, 0.1),
      y: d.dailyReturn || 0,
      r: Math.max(5, Math.min((d.volume || 0) / 2000, 28)),
      raw: d
    })),
    backgroundColor: chartPlotData.map(d => (d.dailyReturn || 0) >= 0 ? 'rgba(239,68,68,0.75)' : 'rgba(34,197,94,0.75)'),
    borderColor: chartPlotData.map(d => (d.dailyReturn || 0) >= 0 ? 'rgba(239,68,68,1)' : 'rgba(34,197,94,1)'),
    borderWidth: 1.5, hoverBorderWidth: 3, hoverBorderColor: '#fff'
  }];

  Chart.defaults.color = '#475569';
  Chart.defaults.font.family = 'Inter, sans-serif';

  try {
    const ctx = document.getElementById('bubbleChart').getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'bubble',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: 'easeOutQuart' },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const el = elements[0];
            const dataPoint = chartInstance.data.datasets[el.datasetIndex].data[el.index];
            if (dataPoint && dataPoint.raw && dataPoint.raw.symbol) {
              window.open(`https://tw.stock.yahoo.com/quote/${dataPoint.raw.symbol}`, '_blank');
            }
          }
        },
        onHover: (event, elements, chart) => {
          chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external: function(context) {
              const tooltipEl = document.getElementById('chart-tooltip');
              const tooltipModel = context.tooltip;
              if (tooltipModel.opacity === 0) { tooltipEl.style.opacity = 0; return; }
              if (tooltipModel.body) {
                const d = tooltipModel.dataPoints[0].raw.raw;
                const returnSign = d.dailyReturn > 0 ? '+' : '';
                const returnColor = d.dailyReturn > 0 ? 'var(--positive-color)' : (d.dailyReturn < 0 ? 'var(--negative-color)' : 'white');
                const amountStr = (d.amount / 100000000).toFixed(2);
                tooltipEl.innerHTML = `
                  <div style="margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px">
                    <strong style="font-size:1.1rem;color:#fff">${d.stock['股票名稱']}</strong>
                    <span style="color:#94a3b8;font-size:0.9rem">(${d.stock['股票代號']})</span>
                  </div>
                  <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:0.95rem">
                    <span style="color:#94a3b8">報酬率:</span>
                    <span style="color:${returnColor};font-weight:bold;text-align:right">${returnSign}${d.dailyReturn.toFixed(2)}%</span>
                    <span style="color:#94a3b8">成交量:</span>
                    <span style="color:#fff;text-align:right">${Math.round(d.volume).toLocaleString()} 張</span>
                    <span style="color:#94a3b8">成交額:</span>
                    <span style="color:#fff;text-align:right">${amountStr} 億</span>
                  </div>
                `;
              }
              const pos = context.chart.canvas.getBoundingClientRect();
              tooltipEl.style.opacity = 1;
              tooltipEl.style.left = (pos.left + window.scrollX + tooltipModel.caretX + 15) + 'px';
              tooltipEl.style.top = (pos.top + window.scrollY + tooltipModel.caretY - 15) + 'px';
            }
          },
          datalabels: {
            color: 'rgba(255,255,255,0.9)',
            font: { weight: 'bold', size: 12 },
            formatter: value => value.raw.stock['股票名稱'],
            align: 'end', anchor: 'end', offset: 2, clip: false,
            display: ctx => ctx.dataset.data[ctx.dataIndex].r >= 8
          }
        },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: '成交金額 (億)', color: '#94a3b8' },
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8' }
          },
          y: {
            title: { display: true, text: '報酬率 (%)', color: '#94a3b8' },
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });

    globalSectorDataForTable = sectorData;
    renderDetailTable(sectorData);

  } catch (err) {
    console.error('Chart initialization failed:', err);
  }
}

// ============================================================
// RENDER DETAIL TABLE (chart view bottom)
// ============================================================
function renderDetailTable(data) {
  const tbody = document.getElementById('detailTableBody');

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center" data-ignore="true">無資料</td></tr>';
    return;
  }

  let sorted = [...data].sort((a, b) => {
    let vA, vB;
    if (currentDetailSort.column === 'return')  { vA = a.dailyReturn; vB = b.dailyReturn; }
    else if (currentDetailSort.column === 'volume') { vA = a.volume; vB = b.volume; }
    else if (currentDetailSort.column === 'amount') { vA = a.amount; vB = b.amount; }
    else { vA = a.symbol || ''; vB = b.symbol || ''; }
    if (vA < vB) return currentDetailSort.order === 'desc' ? 1 : -1;
    if (vA > vB) return currentDetailSort.order === 'desc' ? -1 : 1;
    return 0;
  });

  updateTableDelta(
    tbody,
    sorted,
    (item) => item.symbol, // getRowId
    (tr, item) => { // updateRow
      const oldAmount = tr.getAttribute('data-amount');
      
      if (item.isMissing) {
        tr.innerHTML = `
          <td>${item.stock['股票名稱']} (${item.symbol})</td>
          <td class="text-right text-slate-500">無資料</td>
          <td class="text-right text-slate-500">-</td>
          <td class="text-right text-slate-500">-</td>
        `;
      } else {
        const returnClass = item.dailyReturn > 0 ? 'text-danger color-positive' : (item.dailyReturn < 0 ? 'text-success color-negative' : '');
        const returnSign = item.dailyReturn > 0 ? '+' : '';
        tr.innerHTML = `
          <td>
            <a href="https://tw.stock.yahoo.com/quote/${item.symbol}" target="_blank" class="stock-link">
              ${item.stock['股票名稱']} <span style="color:#94a3b8;font-size:0.9em">(${item.symbol})</span>
            </a>
          </td>
          <td class="text-right font-bold ${returnClass}">${returnSign}${item.dailyReturn.toFixed(2)}%</td>
          <td class="text-right">${Math.round(item.volume).toLocaleString()}</td>
          <td class="text-right">${(item.amount / 100000000).toFixed(2)}</td>
        `;
      }
      
      tr.setAttribute('data-amount', item.amount || 0);
      triggerFlashIfChanged(tr, oldAmount, item.amount || 0);
    }
  );
}

// ============================================================
// START APP
// ============================================================
init();
