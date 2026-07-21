import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Papa from 'papaparse';
import { fetchSnapshot, fetchHistoricalRanking, showToast } from './src/api.js';
import { updateTableDelta, triggerFlashIfChanged } from './src/ui.js';

Chart.register(ChartDataLabels);

// ============================================================
// DASHBOARD LOGIC (TV Layout)
// ============================================================
let activeTvWidget = null;
const renderedPeriods = new Set([1]); // Track which periods are rendered

function showBubbleChart(groupName, mode = 'sector') {
  document.getElementById('tech-chart-view').classList.add('hidden');
  document.getElementById('tech-interval-selector').classList.add('hidden');
  document.getElementById('back-to-bubble-btn').classList.add('hidden');
  
  document.getElementById('bubble-chart-view').classList.remove('hidden');
  document.getElementById('bubble-period-selector').classList.remove('hidden');
  document.getElementById('detail-table-wrapper').classList.remove('hidden');
  
  if (groupName && groupName !== 'ALL') {
    showChart(groupName, mode);
  }
}

function showTechChart(stockData) {
  if (!stockData || !stockData.stock) return;
  const stock = stockData.stock;
  
  // Hide Bubble View
  document.getElementById('bubble-chart-view').classList.add('hidden');
  document.getElementById('bubble-period-selector').classList.add('hidden');
  document.getElementById('detail-table-wrapper').classList.add('hidden');
  
  // Show Tech View
  document.getElementById('tech-chart-view').classList.remove('hidden');
  document.getElementById('tech-interval-selector').classList.remove('hidden');
  document.getElementById('back-to-bubble-btn').classList.remove('hidden');
  
  // Set Title
  document.getElementById('tv-main-title').textContent = stock['股票名稱'] + ' (' + stock['股票代號'] + ')';
  const dReturn = stockData.dailyReturn;
  let returnText = '--';
  if (dReturn !== undefined && isFinite(dReturn)) {
     returnText = dReturn > 0 ? '+' + dReturn.toFixed(2) + '%' : dReturn.toFixed(2) + '%';
     document.getElementById('tv-main-subtitle').className = 'subtitle ' + (dReturn > 0 ? 'color-positive' : (dReturn < 0 ? 'color-negative' : ''));
  }
  document.getElementById('tv-main-subtitle').textContent = '今日漲跌: ' + returnText;

  // Set Tags
  const sectorTags = document.getElementById('tech-sector-tags');
  sectorTags.innerHTML = '';
  if (stock['產業別']) {
    const t = document.createElement('span');
    t.className = 'drawer-tag';
    t.textContent = stock['產業別'];
    t.addEventListener('click', () => { showBubbleChart(stock['產業別'], 'sector'); });
    sectorTags.appendChild(t);
  }

  const themeTags = document.getElementById('tech-theme-tags');
  themeTags.innerHTML = '';
  if (stock['題材清單']) {
    stock['題材清單'].split(',').forEach(theme => {
      if (!theme.trim()) return;
      const t = document.createElement('span');
      t.className = 'drawer-tag';
      t.textContent = theme.trim();
      t.addEventListener('click', () => { showBubbleChart(theme.trim(), 'theme'); });
      themeTags.appendChild(t);
    });
  }

  // TradingView Interval logic
  const market = stock['市場別'] || '';
  const tvSymbol = market.includes('上市') ? 'TWSE:' + stock['股票代號'] : 'TPEX:' + stock['股票代號'];
  document.getElementById('tech-chart-view').setAttribute('data-tv-symbol', tvSymbol);
  
  // Set default interval active state
  document.querySelectorAll('#tech-interval-selector .interval-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('#tech-interval-selector .interval-btn[data-interval="D"]').classList.add('active');
  
  renderTvWidget(tvSymbol, 'D');
}

function renderTvWidget(symbol, interval) {
  const container = document.getElementById('tradingview-widget-container');
  container.innerHTML = '';
  if (window.TradingView) {
    activeTvWidget = new TradingView.widget({
      "autosize": true,
      "symbol": symbol,
      "interval": interval,
      "timezone": "Asia/Taipei",
      "theme": "dark",
      "style": "1",
      "locale": "zh_TW",
      "enable_publishing": false,
      "backgroundColor": "rgba(15, 23, 42, 1)",
      "hide_top_toolbar": true, 
      "hide_legend": false,
      "save_image": false,
      "container_id": "tradingview-widget-container"
    });
  }
}

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
const viewThemeRanking = document.getElementById('view-theme');
const viewRadar = document.getElementById('view-radar');
const canvas = document.getElementById('bubbleChart');
const backBtn = document.getElementById('back-to-bubble-btn');
const sortableHeaders = document.querySelectorAll('.ranking-table th.sortable:not(.radar-sortable):not(.theme-sortable)');
const themeSortableHeaders = document.querySelectorAll('.theme-sortable');

// --- Drawer Elements ---
// --- Drawer Elements (Removed) ---
const tvWidgetContainer = document.getElementById('tradingview-widget-container');

// --- DOM Cache Helper ---
function getTbody(viewId, days) {
  let baseId = '';
  if (viewId === 'view-ranking') baseId = 'rankingTableBody';
  else if (viewId === 'view-theme') baseId = 'themeRankingTableBody';
  else if (viewId === 'view-radar') baseId = 'radarTableBody';
  return document.getElementById(`${baseId}_${days}`);
}

function switchPeriodTbody(viewId, days) {
  let baseId = '';
  if (viewId === 'view-ranking') baseId = 'rankingTableBody';
  else if (viewId === 'view-theme') baseId = 'themeRankingTableBody';
  else if (viewId === 'view-radar') baseId = 'radarTableBody';
  
  [1, 5, 10, 20].forEach(d => {
    const tbody = document.getElementById(`${baseId}_${d}`);
    if (tbody) {
      if (d === days) tbody.classList.remove('hidden');
      else tbody.classList.add('hidden');
    }
  });
}

const radarSortableHeaders = document.querySelectorAll('.radar-sortable');
const navBtns = document.querySelectorAll('.sidebar-tab');

// --- Drawer Listeners ---
// --- Drawer Listeners (Removed) ---

document.querySelectorAll('#tech-interval-selector .interval-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('#tech-interval-selector .interval-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    const interval = e.target.getAttribute('data-interval');
    const symbol = document.getElementById('tech-chart-view').getAttribute('data-tv-symbol');
    if (symbol) {
      renderTvWidget(symbol, interval);
    }
  });
});

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
// DEBOUNCE HELPER
// ============================================================
function debounceUI(fn, delay = 50) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ============================================================
// INIT
// ============================================================
async function init() {
  try {
    // 1. Load historical ranking JSON (pre-calculated 5/10/20 day data)
    //    — run in background, do NOT await here so CSV loading starts immediately
    const historicalPromise = fetchHistoricalRanking().then(data => {
      historicalRanking = data;
      if (data) {
        const updatedAt = data.updated_at
          ? new Date(data.updated_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
          : '未知';
        console.log(`[HistoricalRanking] Loaded. Updated at: ${updatedAt}`);
      } else {
        console.warn('[HistoricalRanking] Not available, 5/10/20 day ranking will be disabled.');
      }
    });

    // 2. Load CSV in parallel with historical data
    const todayStr = new Date().toISOString().split('T')[0];
    const csvPromise = new Promise((resolve, reject) => {
      Papa.parse(`./stocks.csv?v=${todayStr}`, {
        download: true,
        header: true,
        complete: function(results) {
          allStocks = results.data.filter(d => d['股票代號'] && d['股票名稱']);
          resolve();
        },
        error: reject
      });
    });

    // 3. Wait for CSV to finish, then kick off live snapshot
    //    Historical data can still be loading — that's fine, it's non-blocking
    await csvPromise;
    processData(); // first live load — shows data ASAP

    // ---- Navigation ----
    navBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetViewId = e.currentTarget.getAttribute('data-target');
        navBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        switchView(targetViewId);
        if (targetViewId !== 'view-chart') currentSector = null;

        // Lazy Rendering on tab switch
        if (currentPeriodDays !== 1 && historicalRanking && historicalRanking[String(currentPeriodDays)]) {
          const periodData = historicalRanking[String(currentPeriodDays)];
          if (targetViewId === 'view-ranking') {
            const orig = [...sectorRankingData];
            sectorRankingData = periodData.sectors.filter(s => isFinite(s.avgReturn));
            renderRanking(`近 ${currentPeriodDays} 日排行`);
            sectorRankingData = orig;
          } else if (targetViewId === 'view-theme') {
            const orig = [...themeRankingData];
            themeRankingData = periodData.themes.filter(t => isFinite(t.avgReturn));
            renderThemeRanking(`近 ${currentPeriodDays} 日排行`);
            themeRankingData = orig;
          } else if (targetViewId === 'view-radar') {
            currentRadarData = periodData.radar || [];
            resortRadar();
          }
        } else if (currentPeriodDays === 1) {
          if (targetViewId === 'view-ranking') renderRanking();
          else if (targetViewId === 'view-theme') renderThemeRanking();
          else if (targetViewId === 'view-radar') renderRadar();
        }
      });
    });

    backBtn.addEventListener('click', () => {
      showBubbleChart(currentSector, currentChartMode);
    });

    sortableHeaders.forEach(h => {
      h.addEventListener('click', () => {
        const col = h.getAttribute('data-sort');
        if (sortCol === col) sortDesc = !sortDesc; else { sortCol = col; sortDesc = true; }
        updateSortUI();
        if (currentPeriodDays === 1) renderRanking();
        else {
          if (historicalRanking && historicalRanking[String(currentPeriodDays)]) {
            const orig = [...sectorRankingData];
            sectorRankingData = historicalRanking[String(currentPeriodDays)].sectors.filter(s => isFinite(s.avgReturn));
            renderRanking(`近 ${currentPeriodDays} 日排行`);
            sectorRankingData = orig;
          }
        }
      });
    });

    themeSortableHeaders.forEach(h => {
      h.addEventListener('click', () => {
        const col = h.getAttribute('data-sort');
        if (themeSortCol === col) themeSortDesc = !themeSortDesc; else { themeSortCol = col; themeSortDesc = true; }
        updateThemeSortUI();
        if (currentPeriodDays === 1) renderThemeRanking();
        else {
          if (historicalRanking && historicalRanking[String(currentPeriodDays)]) {
            const orig = [...themeRankingData];
            themeRankingData = historicalRanking[String(currentPeriodDays)].themes.filter(t => isFinite(t.avgReturn));
            renderThemeRanking(`近 ${currentPeriodDays} 日排行`);
            themeRankingData = orig;
          }
        }
      });
    });

    radarSortableHeaders.forEach(h => {
      h.addEventListener('click', () => {
        const col = h.getAttribute('data-sort');
        if (radarSortCol === col) radarSortDesc = !radarSortDesc; else { radarSortCol = col; radarSortDesc = true; }
        updateRadarSortUI();
        if (currentPeriodDays !== 1 && currentRadarData.length > 0) resortRadar();
        else renderRadar();
      });
    });

    // ---- Period buttons ----
    document.querySelectorAll('#bubble-period-selector .period-btn').forEach(btn => {
      btn.addEventListener('click', debounceUI((e) => {
        const days = parseInt(e.target.getAttribute('data-days'));
        if (currentPeriodDays === days) return;
        currentPeriodDays = days;

        document.querySelectorAll('#bubble-period-selector .period-btn').forEach(b => {
          if (parseInt(b.getAttribute('data-days')) === days) b.classList.add('active');
          else b.classList.remove('active');
        });

        switchPeriodTbody('view-ranking', days);
        switchPeriodTbody('view-theme', days);
        switchPeriodTbody('view-radar', days);
        
        // If we are currently in bubble view, re-render chart if needed, 
        // wait, we can just update chart without calling showChart again if we just update the data.
        if (!document.getElementById('bubble-chart-view').classList.contains('hidden') && currentSector) {
           renderChart(currentSector, currentChartMode);
        }

        if (!renderedPeriods.has(days)) {
          if (days === 1) {
            renderRanking();
            renderThemeRanking();
            renderRadar();
            renderedPeriods.add(1);
          } else if (historicalPromise) {
            document.getElementById('chart-loading-overlay').classList.remove('hidden');
            historicalPromise.then(() => {
              renderHistoricalRanking(currentPeriodDays);
              renderedPeriods.add(currentPeriodDays);
              document.getElementById('chart-loading-overlay').classList.add('hidden');
            });
          }
        }
      }, 80));
    });

    // ---- Detail table sorting ----
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

    // ---- Auto-refresh every 15s (live mode only) ----
    setInterval(() => {
      if (currentPeriodDays === 1) processData(true);
    }, 15000);

  } catch (error) {
    console.error('Init failed:', error);
    document.getElementById('last-updated').textContent = '初始化失敗，請重新整理頁面。';
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
    if (currentSector && !document.getElementById('bubble-chart-view').classList.contains('hidden') && currentPeriodDays === 1) {
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
    getTbody('view-ranking', days).innerHTML = `<tr><td colspan="5" class="text-center" style="color:#94a3b8">歷史資料尚未產生，請稍後再試</td></tr>`;
    getTbody('view-theme', days).innerHTML = `<tr><td colspan="5" class="text-center" style="color:#94a3b8">歷史資料尚未產生</td></tr>`;
    getTbody('view-radar', days).innerHTML = `<tr><td colspan="6" class="text-center" style="color:#94a3b8">歷史資料尚未產生</td></tr>`;
    return;
  }

  const periodData = historicalRanking[String(days)];
  const updatedAt = historicalRanking.updated_at
    ? new Date(historicalRanking.updated_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
    : '';

  const activeView = document.querySelector('.main-view:not(.hidden)')?.id;

  // Temporarily override with historical data for rendering
  const origSector = [...sectorRankingData];
  const origTheme = [...themeRankingData];

  sectorRankingData = periodData.sectors.filter(s => isFinite(s.avgReturn));
  themeRankingData = periodData.themes.filter(t => isFinite(t.avgReturn));

  // Render ALL 3 views simultaneously! Chunked rendering handles them smoothly in background.
  renderRanking(`近 ${days} 日排行 (更新: ${updatedAt})`, days);
  renderThemeRanking(`近 ${days} 日排行`, days);
  
  const desc = document.getElementById('radar-description');
  if (desc && activeView === 'view-radar') desc.textContent = `顯示全市場近 ${days} 日累積成交金額最高的前 200 檔個股`;
  currentRadarData = periodData.radar || [];
  resortRadar(days);

  // Restore
  sectorRankingData = origSector;
  themeRankingData = origTheme;
}

// ============================================================
// RENDER RANKING TABLE
// ============================================================
function renderRanking(subTitle = '', targetDays = currentPeriodDays) {
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

  const tbody = getTbody('view-ranking', targetDays);
  updateTableDelta(
    tbody,
    data,
    (d) => d.sector, // getRowId
    (tr, d, index) => { // updateRow
      const returnClass = d.avgReturn > 0 ? 'color-positive' : (d.avgReturn < 0 ? 'color-negative' : '');
      const returnSign = d.avgReturn > 0 ? '+' : '';
      const amountStr = (d.totalAmount / 100000000).toFixed(2);
      
      const amountPct = Math.min((d.totalAmount / (data[0] && data[0].totalAmount || 1)) * 100, 100);
      const returnPct = Math.min(Math.abs(d.avgReturn) / 10 * 100, 100);
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
function renderThemeRanking(subTitle = '', targetDays = currentPeriodDays) {
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

  const tbody = getTbody('view-theme', targetDays);
  updateTableDelta(
    tbody,
    data,
    (d) => d.theme, // getRowId
    (tr, d, index) => { // updateRow
      const returnClass = d.avgReturn > 0 ? 'color-positive' : (d.avgReturn < 0 ? 'color-negative' : '');
      const returnSign = d.avgReturn > 0 ? '+' : '';
      const amountStr = (d.totalAmount / 100000000).toFixed(2);
      
      const amountPct = Math.min((d.totalAmount / (data[0] && data[0].totalAmount || 1)) * 100, 100);
      const returnPct = Math.min(Math.abs(d.avgReturn) / 10 * 100, 100);
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
  resortRadar(1);
}

// ============================================================
// RENDER RADAR TABLE (sorting re-entry for historical mode)
// ============================================================
function resortRadar(targetDays = currentPeriodDays) {
  let sorted = [...currentRadarData];
  sorted.sort((a, b) => {
    const vA = radarSortCol === 'amount' ? a.amount : (radarSortCol === 'volume' ? a.volume : a.dailyReturn);
    const vB = radarSortCol === 'amount' ? b.amount : (radarSortCol === 'volume' ? b.volume : b.dailyReturn);
    return radarSortDesc ? vB - vA : vA - vB;
  });
  renderRadarFromData(sorted.slice(0, 200), targetDays);
}

// ============================================================
// RENDER RADAR TABLE (from any data source)
// ============================================================
function renderRadarFromData(data, targetDays = currentPeriodDays) {
  const tbody = getTbody('view-radar', targetDays);
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">暫無交易資料</td></tr>';
    return;
  }

  updateTableDelta(
    tbody,
    data,
    (d) => d.stock ? d.stock['股票代號'] : d.symbol,
    (tr, d, index) => {
      const stock = d.stock;
      if (!stock) return;
      const stockSector = stock['產業別'] || '無';
      const dReturn = d.dailyReturn;
      const returnClass = dReturn > 0 ? 'color-positive' : (dReturn < 0 ? 'color-negative' : '');
      const returnSign = dReturn > 0 ? '+' : '';
      const amountStr = (d.amount / 100000000).toFixed(2);
      
      const amountPct = Math.min((d.amount / (data[0].amount || 1)) * 100, 100);
      const returnPct = Math.min(Math.abs(dReturn) / 10 * 100, 100);
      const returnBarColor = dReturn > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)';

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>
          <div class="stock-name-cell">
            <strong>${stock['股票名稱']}</strong>
            <span class="stock-symbol">${stock['股票代號']}</span>
          </div>
        </td>
        <td><span class="badge-sector">${stockSector}</span></td>
        <td class="text-right ${returnClass} data-bar-cell">
          <div class="data-bar" style="width:${returnPct}%;background:${returnBarColor}"></div>
          <strong class="data-bar-text">${returnSign}${dReturn.toFixed(2)}%</strong>
        </td>
        <td class="text-right">${Math.round(d.volume).toLocaleString()}</td>
        <td class="text-right data-bar-cell">
          <div class="data-bar" style="width:${amountPct}%;background:rgba(56,189,248,0.15)"></div>
          <span class="data-bar-text">${amountStr}</span>
        </td>
      `;
      if (!tr.hasAttribute('data-amount')) {
         tr.addEventListener('click', () => {
             showTechChart(d);
         });
      }
      const oldAmount = tr.getAttribute('data-amount');
      tr.setAttribute('data-amount', d.amount);
      triggerFlashIfChanged(tr, oldAmount, d.amount);
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
  document.querySelectorAll('.sidebar-view').forEach(v => {
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
  document.getElementById('tv-main-title').textContent = `${identifier} ${modeText}分析`;

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
  document.getElementById('tv-main-title').textContent = `${identifier} ${modeText}分析`;

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
    document.getElementById('tv-main-title').textContent = `${identifier} ${modeText}分析 (無資料)`;
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
      document.getElementById('tv-main-title').textContent = `${identifier} ${modeText}分析 (歷史資料缺失)`;
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
    document.getElementById('tv-main-title').textContent = `${identifier} ${modeText}分析 (近 ${currentPeriodDays} 日)`;
  }

  overlay.classList.add('hidden');

  // ---- CHART ----
  const chartPlotData = sectorData.filter(d => !d.isMissing && d.amount > 0);
  if (chartPlotData.length === 0) {
    document.getElementById('tv-main-title').textContent += ' - 無圖表資料';
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
        animation: { duration: 150, easing: 'easeOutQuad' },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const el = elements[0];
            const dataPoint = chartInstance.data.datasets[el.datasetIndex].data[el.index];
            if (dataPoint && dataPoint.raw && dataPoint.raw.symbol) {
              const fullStockData = globalSectorDataForTable.find(d => d.symbol === dataPoint.raw.symbol);
              if (fullStockData) {
                showTechChart(fullStockData);
              } else {
                window.open(`https://tw.stock.yahoo.com/quote/${dataPoint.raw.symbol}`, '_blank');
              }
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
            <a href="#" class="stock-link">
              ${item.stock['股票名稱']} <span style="color:#94a3b8;font-size:0.9em">(${item.symbol})</span>
            </a>
          </td>
          <td class="text-right font-bold ${returnClass}">${returnSign}${item.dailyReturn.toFixed(2)}%</td>
          <td class="text-right">${Math.round(item.volume).toLocaleString()}</td>
          <td class="text-right">${(item.amount / 100000000).toFixed(2)}</td>
        `;
        
        if (!tr.hasAttribute('data-amount')) {
          tr.addEventListener('click', (e) => {
            e.preventDefault();
            showTechChart({ stock: item.stock, dailyReturn: item.dailyReturn, volume: item.volume, amount: item.amount });
          });
        }
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
