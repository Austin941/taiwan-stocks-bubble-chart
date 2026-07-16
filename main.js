import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Papa from 'papaparse';

Chart.register(ChartDataLabels);

// State
let allStocks = [];
let allMarketData = [];
let sectorRankingData = [];
let themeRankingData = [];
let sectors = new Set();
let themes = new Set();
let chartInstance = null;
let currentSector = null;
let currentChartMode = 'sector'; // 'sector' or 'theme'
let currentPeriodDays = 1; // 1 = today, >1 = historical period

// Global error handler for debugging
window.onerror = function(message, source, lineno, colno, error) {
  const chartContainer = document.querySelector('.chart-container-glass');
  if (chartContainer) {
    chartContainer.innerHTML = `<div style="color: red; padding: 20px;">
      <h3>Error Occurred:</h3>
      <p>${message}</p>
      <p>Line: ${lineno}:${colno}</p>
      <pre>${error ? error.stack : ''}</pre>
    </div>`;
  }
};
window.addEventListener('unhandledrejection', function(event) {
  const chartContainer = document.querySelector('.chart-container-glass');
  if (chartContainer) {
    chartContainer.innerHTML = `<div style="color: red; padding: 20px;">
      <h3>Unhandled Promise Rejection:</h3>
      <pre>${event.reason ? event.reason.stack || event.reason : 'Unknown Error'}</pre>
    </div>`;
  }
});

// Sorting State
let sortCol = 'amount'; // 'amount', 'volume', or 'return'
let sortDesc = true;

// Radar Sorting State
let radarSortCol = 'amount'; // 'amount', 'volume', or 'return'
let radarSortDesc = true;

// Theme Sorting State
let themeSortCol = 'amount';
let themeSortDesc = true;

// DOM Elements
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

// Initialize
async function init() {
  try {
    Papa.parse('./stocks.csv?v=' + new Date().getTime(), {
      download: true,
      header: true,
      complete: function(results) {
        allStocks = results.data.filter(d => d['股票代號'] && d['股票名稱']); // 確保不收空行
        processData();
      }
    });

    // Setup Navigation Tabs
    navBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Remove active from all
        navBtns.forEach(b => b.classList.remove('active'));
        // Add active to clicked
        e.target.classList.add('active');
        
        const targetViewId = e.target.getAttribute('data-target');
        switchView(targetViewId);
        
        // Reset chart state if leaving chart view
        if (targetViewId !== 'view-chart') {
          currentSector = null;
        }
      });
    });

    backBtn.addEventListener('click', () => {
      // Find the currently active nav button and trigger click to restore view
      const activeNav = document.querySelector('.nav-btn.active') || navBtns[0];
      switchView(activeNav.getAttribute('data-target'));
      currentSector = null; // Clear chart state
    });

    // Setup Sorting Listeners for Ranking
    sortableHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const col = header.getAttribute('data-sort');
        if (sortCol === col) {
          sortDesc = !sortDesc; // toggle order
        } else {
          sortCol = col;
          sortDesc = true; // default to descending for new column
        }
        updateSortUI();
        renderRanking();
      });
    });

    // Setup Sorting Listeners for Theme
    themeSortableHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const col = header.getAttribute('data-sort');
        if (themeSortCol === col) {
          themeSortDesc = !themeSortDesc;
        } else {
          themeSortCol = col;
          themeSortDesc = true;
        }
        updateThemeSortUI();
        renderThemeRanking();
      });
    });

    // Setup Sorting Listeners for Radar
    radarSortableHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const col = header.getAttribute('data-sort');
        if (radarSortCol === col) {
          radarSortDesc = !radarSortDesc;
        } else {
          radarSortCol = col;
          radarSortDesc = true;
        }
        updateRadarSortUI();
        renderRadar();
      });
    });

    // Render Initial View
    updateSortUI();
    updateThemeSortUI();
    updateRadarSortUI();
    // Set up auto-refresh every 30 seconds for the Ranking view
    setInterval(() => {
      // Only refresh if we are currently looking at the ranking view
      if (currentSector === null) {
        processData();
      }
    }, 30000);
  } catch (error) {
    console.error('Failed to load data:', error);
    rankingTableBody.innerHTML = '<tr><td colspan="5" class="text-center">載入資料失敗</td></tr>';
  }
}

async function processData() {
  try {
    const response = await fetch('/api/snapshot');
    const result = await response.json();
    
    // Check if it's the new format with metadata, or old raw format
    const marketCache = result.data || result;
    const isMarketOpen = result.isMarketOpen !== undefined ? result.isMarketOpen : true;
    
    // Update timestamp
    const now = new Date();
    const marketStatus = isMarketOpen ? '' : ' (已收盤)';
    document.getElementById('last-updated').textContent = `最後更新時間：${now.toLocaleTimeString('zh-TW', { hour12: false })}${marketStatus}`;
    
    // Clear sectors set for fresh repopulation
    sectors.clear();

    // 1. Generate individual stock market data from backend snapshot
    allMarketData = allStocks.map(stock => {
      const symbol = stock['股票代號'];
      let dailyReturn = 0;
      let volume = 0;
      let amount = 0;
      let price = 0;

      // Extract raw data from cache if available
      if (marketCache[symbol]) {
        const data = marketCache[symbol];
        price = data.price;
        volume = data.volume;
        if (data.prevClose && data.prevClose > 0) {
          dailyReturn = ((price - data.prevClose) / data.prevClose) * 100;
        }
        amount = price * volume * 1000;
      } else {
        dailyReturn = 0;
        volume = 0;
        amount = 0;
      }
      
      if (stock['產業別'] && stock['產業別'] !== '無' && stock['產業別'] !== '') {
        sectors.add(stock['產業別']);
      }

      return {
        stock,
        dailyReturn,
        volume,
        amount,
        price
      };
    });

    const sectorMap = {};
    const themeMap = {};

    allMarketData.forEach(d => {
      const sector = d.stock['產業別'];
      if (sector && sector !== '無' && sector !== '') {
        if (!sectorMap[sector]) {
          sectorMap[sector] = { sector: sector, totalVolume: 0, totalAmount: 0, weightedReturnSum: 0, count: 0 };
        }
        sectorMap[sector].totalVolume += d.volume;
        sectorMap[sector].totalAmount += d.amount;
        sectorMap[sector].weightedReturnSum += (d.dailyReturn * d.amount);
        sectorMap[sector].count += 1;
      }

      // Parse themes with a filter for redundant/generic tags
      const themesStr = d.stock['題材清單'];
      if (themesStr && themesStr !== '') {
        const blacklist = ['半導體', '電子零組件', '電子代工', '通信網路', '其他電子', '光電', '電腦及週邊設備'];
        const themesArr = themesStr.split('、')
          .map(t => t.trim())
          .filter(t => t.length > 0 && t !== d.stock['產業別'] && !blacklist.includes(t)); // 過濾掉與產業別完全相同的標籤，或過於廣泛的黑名單標籤
          
        themesArr.forEach(theme => {
          if (!themeMap[theme]) {
            themeMap[theme] = { theme: theme, totalVolume: 0, totalAmount: 0, weightedReturnSum: 0, count: 0 };
          }
          themeMap[theme].totalVolume += d.volume;
          themeMap[theme].totalAmount += d.amount;
          themeMap[theme].weightedReturnSum += (d.dailyReturn * d.amount);
          themeMap[theme].count += 1;
        });
      }
    });

    sectorRankingData = Object.keys(sectorMap).map(sector => {
      const data = sectorMap[sector];
      const avgReturn = data.totalAmount > 0 ? (data.weightedReturnSum / data.totalAmount) : 0;
      return { sector, totalVolume: data.totalVolume, totalAmount: data.totalAmount, avgReturn };
    });

    themeRankingData = Object.keys(themeMap).map(theme => {
      const data = themeMap[theme];
      const avgReturn = data.totalAmount > 0 ? (data.weightedReturnSum / data.totalAmount) : 0;
      return { theme, totalVolume: data.totalVolume, totalAmount: data.totalAmount, avgReturn };
    });

    // Render Ranking and Radar after processing data
    renderRanking();
    renderThemeRanking();
    renderRadar();

  } catch (error) {
    console.error('Error fetching market snapshot:', error);
    document.getElementById('last-updated').textContent = '最後更新時間：載入失敗，請稍後再試。';
  }
}
function renderThemeRanking() {
  themeRankingTableBody.innerHTML = '';
  
  // Sort the data
  themeRankingData.sort((a, b) => {
    let valA, valB;
    if (themeSortCol === 'amount') {
      valA = a.totalAmount; valB = b.totalAmount;
    } else if (themeSortCol === 'volume') {
      valA = a.totalVolume; valB = b.totalVolume;
    } else {
      valA = a.avgReturn; valB = b.avgReturn;
    }
    return themeSortDesc ? valB - valA : valA - valB;
  });

  const maxAmount = Math.max(...themeRankingData.map(d => d.totalAmount), 1);
  const maxReturn = Math.max(...themeRankingData.map(d => Math.abs(d.avgReturn)), 1);

  themeRankingData.forEach((d, index) => {
    const tr = document.createElement('tr');
    
    // Animation flash for update
    tr.classList.add('flash-up');
    setTimeout(() => tr.classList.remove('flash-up'), 1000);

    const returnClass = d.avgReturn > 0 ? 'color-positive' : (d.avgReturn < 0 ? 'color-negative' : '');
    const returnSign = d.avgReturn > 0 ? '+' : '';
    const amountHundredMillion = (d.totalAmount / 10000).toFixed(2);

    const amountPct = (d.totalAmount / maxAmount) * 100;
    const returnPct = (Math.abs(d.avgReturn) / maxReturn) * 100;
    const returnBarColor = d.avgReturn > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td><span class="badge-sector">${d.theme}</span></td>
      <td class="text-right ${returnClass} data-bar-cell">
        <div class="data-bar" style="width: ${returnPct}%; background: ${returnBarColor};"></div>
        <strong class="data-bar-text">${returnSign}${d.avgReturn.toFixed(2)}%</strong>
      </td>
      <td class="text-right">${d.totalVolume.toLocaleString()}</td>
      <td class="text-right data-bar-cell">
        <div class="data-bar" style="width: ${amountPct}%; background: rgba(56, 189, 248, 0.15);"></div>
        <span class="data-bar-text">${amountHundredMillion}</span>
      </td>
    `;

    // Click on a row goes to the chart
    tr.addEventListener('click', () => {
      showChart(d.theme, 'theme');
    });

    themeRankingTableBody.appendChild(tr);
  });
}
function renderRadar() {
  radarTableBody.innerHTML = '';
  
  // Sort all stocks by selected column
  const sortedStocks = [...allMarketData]
    .filter(d => d.amount > 0) // Only show active stocks
    .sort((a, b) => {
      let valA, valB;
      if (radarSortCol === 'amount') {
        valA = a.amount; valB = b.amount;
      } else if (radarSortCol === 'volume') {
        valA = a.volume; valB = b.volume;
      } else {
        valA = a.dailyReturn; valB = b.dailyReturn;
      }
      return radarSortDesc ? valB - valA : valA - valB;
    })
    .slice(0, 100); // Top 100
    
  if (sortedStocks.length === 0) {
    radarTableBody.innerHTML = '<tr><td colspan="6" class="text-center">目前無交易資料</td></tr>';
    return;
  }
  
  sortedStocks.forEach((stock, index) => {
    const tr = document.createElement('tr');
    
    // Animation flash for update
    tr.classList.add('flash-up');
    setTimeout(() => tr.classList.remove('flash-up'), 1000);
    
    const returnClass = stock.dailyReturn > 0 ? 'color-positive' : (stock.dailyReturn < 0 ? 'color-negative' : '');
    const returnSign = stock.dailyReturn > 0 ? '+' : '';
    const amountHundredMillion = (stock.amount / 10000).toFixed(2);
    
    // Calculate Data Bar percentages
    // Radar is sorted by amount or volume, we can use an absolute max or just max of top 100
    const maxRadarAmount = Math.max(...sortedStocks.map(s => s.amount), 1);
    const maxRadarReturn = Math.max(...sortedStocks.map(s => Math.abs(s.dailyReturn)), 1);
    
    const amountPct = (stock.amount / maxRadarAmount) * 100;
    const returnPct = (Math.abs(stock.dailyReturn) / maxRadarReturn) * 100;
    const returnBarColor = stock.dailyReturn > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';
    
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${stock.stock['股票名稱']} <span style="font-size:0.9em;color:var(--text-secondary)">${stock.stock['股票代號']}</span></td>
      <td class="text-right"><span class="badge-sector">${stock.stock['產業別']}</span></td>
      <td class="text-right ${returnClass} data-bar-cell">
        <div class="data-bar" style="width: ${returnPct}%; background: ${returnBarColor};"></div>
        <strong class="data-bar-text">${returnSign}${stock.dailyReturn.toFixed(2)}%</strong>
      </td>
      <td class="text-right">${stock.volume.toLocaleString()}</td>
      <td class="text-right data-bar-cell">
        <div class="data-bar" style="width: ${amountPct}%; background: rgba(56, 189, 248, 0.15);"></div>
        <span class="data-bar-text">${amountHundredMillion}</span>
      </td>
    `;
    
    // Click on a radar row goes to the sector chart
    tr.addEventListener('click', () => {
      showChart(stock.stock['產業別'], 'sector');
    });
    
    radarTableBody.appendChild(tr);
  });
}

function renderRanking() {
  rankingTableBody.innerHTML = '';
  
  // Sort the data
  sectorRankingData.sort((a, b) => {
    let valA, valB;
    if (sortCol === 'amount') {
      valA = a.totalAmount; valB = b.totalAmount;
    } else if (sortCol === 'volume') {
      valA = a.totalVolume; valB = b.totalVolume;
    } else {
      valA = a.avgReturn; valB = b.avgReturn;
    }
    return sortDesc ? valB - valA : valA - valB;
  });

  const maxAmount = Math.max(...sectorRankingData.map(d => d.totalAmount), 1);
  const maxReturn = Math.max(...sectorRankingData.map(d => Math.abs(d.avgReturn)), 1);

  sectorRankingData.forEach((d, index) => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-sector', d.sector);
    
    // Animation flash for update
    tr.classList.add('flash-up');
    setTimeout(() => tr.classList.remove('flash-up'), 1000);

    const returnClass = d.avgReturn > 0 ? 'color-positive' : (d.avgReturn < 0 ? 'color-negative' : '');
    const returnSign = d.avgReturn > 0 ? '+' : '';
    const amountHundredMillion = (d.totalAmount / 10000).toFixed(2);
    
    const amountPct = (d.totalAmount / maxAmount) * 100;
    const returnPct = (Math.abs(d.avgReturn) / maxReturn) * 100;
    const returnBarColor = d.avgReturn > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td><span class="badge-sector">${d.sector}</span></td>
      <td class="text-right ${returnClass} data-bar-cell">
        <div class="data-bar" style="width: ${returnPct}%; background: ${returnBarColor};"></div>
        <strong class="data-bar-text">${returnSign}${d.avgReturn.toFixed(2)}%</strong>
      </td>
      <td class="text-right">${d.totalVolume.toLocaleString()}</td>
      <td class="text-right data-bar-cell">
        <div class="data-bar" style="width: ${amountPct}%; background: rgba(56, 189, 248, 0.15);"></div>
        <span class="data-bar-text">${amountHundredMillion}</span>
      </td>
    `;
    
    // Add click event listener to the row
    tr.addEventListener('click', () => {
      showChart(d.sector, 'sector');
    });
    
    rankingTableBody.appendChild(tr);
  });
}

function updateSortUI() {
  sortableHeaders.forEach(header => {
    const col = header.getAttribute('data-sort');
    const icon = header.querySelector('.sort-icon');
    if (col === sortCol) {
      header.setAttribute('data-active', 'true');
      icon.textContent = sortDesc ? '▼' : '▲';
    } else {
      header.removeAttribute('data-active');
      icon.textContent = '';
    }
  });
}


function updateRadarSortUI() {
  radarSortableHeaders.forEach(header => {
    const col = header.getAttribute('data-sort');
    const icon = header.querySelector('.sort-icon');
    if (col === radarSortCol) {
      header.setAttribute('data-active', 'true');
      icon.textContent = radarSortDesc ? '▼' : '▲';
    } else {
      header.removeAttribute('data-active');
      icon.textContent = '';
    }
  });
}

function switchView(targetViewId) {
  // Update Nav Buttons
  if (targetViewId !== 'view-chart') {
    navBtns.forEach(b => {
      if (b.getAttribute('data-target') === targetViewId) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  // Hide all views
  const views = [viewRanking, viewThemeRanking, viewRadar, viewChart];
  views.forEach(v => {
    v.classList.add('hidden');
    v.classList.remove('active');
  });

  // Show target view
  const targetView = document.getElementById(targetViewId);
  if (targetView) {
    targetView.classList.remove('hidden');
    targetView.classList.add('active');
  }
}

function updateThemeSortUI() {
  themeSortableHeaders.forEach(header => {
    const col = header.getAttribute('data-sort');
    const icon = header.querySelector('.sort-icon');
    if (col === themeSortCol) {
      header.setAttribute('data-active', 'true');
      icon.textContent = themeSortDesc ? '▼' : '▲';
    } else {
      header.removeAttribute('data-active');
      icon.textContent = '';
    }
  });
}

function showChart(identifier, mode = 'sector') {
  currentSector = identifier;
  currentChartMode = mode;
  
  // Switch Views
  switchView('view-chart');
  
  const modeText = mode === 'sector' ? '族群' : '題材概念股';
  currentSectorTitle.textContent = `${identifier} ${modeText}分析`;
  
  // Reset period to 1 (today) when switching sector
  currentPeriodDays = 1;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.period-btn[data-period="1"]').classList.add('active');
  
  renderChart(identifier, mode);
}

// Bind period buttons
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentPeriodDays = parseInt(e.target.getAttribute('data-period'));
    renderChart(currentSector, currentChartMode);
  });
});

async function renderChart(identifier, mode) {
  // 1. Clear existing chart
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  
  let sectorData = [];
  
  // 2. Data Gathering
  if (currentPeriodDays === 1) {
    // Filter snapshot data
    if (mode === 'sector') {
      sectorData = allMarketData.filter(d => d.stock['產業別'] === identifier);
    } else {
      sectorData = allMarketData.filter(d => {
        const themes = d.stock['題材清單'];
        return themes && themes.includes(identifier);
      });
    }
    
    // Safety filter
    sectorData = sectorData.filter(d => d && d.amount > 0 && d.volume > 0 && !isNaN(d.dailyReturn));
    
    // Sort and slice top 50
    sectorData.sort((a, b) => b.amount - a.amount);
    sectorData = sectorData.slice(0, 50);
    
    // Deep clone to prevent mutating global cache
    sectorData = JSON.parse(JSON.stringify(sectorData));
    
  } else {
    // Historical Data Gathering
    // To prevent Vercel serverless timeouts (10s limit), we pre-sort by today's amount
    // and ONLY fetch historical data for the top 50 stocks in the sector/theme.
    let baseData = [];
    if (mode === 'sector') {
      baseData = allMarketData.filter(d => d.stock['產業別'] === identifier);
    } else {
      baseData = allMarketData.filter(d => {
        const themes = d.stock['題材清單'];
        return themes && themes.includes(identifier);
      });
    }
    
    // Sort by today's amount and slice to top 50 BEFORE sending to backend
    baseData.sort((a, b) => b.amount - a.amount);
    baseData = baseData.slice(0, 50).map(d => d.stock);
    
    const symbolsWithSuffix = baseData.map(s => {
      const market = s['市場別'];
      return market.includes('上市') ? `${s['股票代號']}.TW` : `${s['股票代號']}.TWO`;
    });
    
    const modeText = mode === 'sector' ? '族群' : '題材概念股';
    currentSectorTitle.textContent = `${identifier} ${modeText}分析 (歷史資料載入中...)`;
    
    try {
      const res = await fetch(`/api/period_analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: symbolsWithSuffix, days: currentPeriodDays })
      });
      const periodResults = await res.json();
      
      for (const s of baseData) {
        if (periodResults[s['股票代號']]) {
          const p = periodResults[s['股票代號']];
          if (p.totalAmount > 0 && p.totalVolume > 0) {
            sectorData.push({
              symbol: s['股票代號'],
              name: s['股票名稱'],
              stock: s,
              dailyReturn: p.cumulativeReturn || 0,
              volume: p.totalVolume,
              amount: p.totalAmount
            });
          }
        }
      }
    } catch(e) {
      console.error('Failed to fetch period analysis', e);
    }
    
    sectorData.sort((a, b) => b.amount - a.amount);
    sectorData = sectorData.slice(0, 50);
    
    const modeText = mode === 'sector' ? '族群' : '題材概念股';
    currentSectorTitle.textContent = `${identifier} ${modeText}分析`;
  }

  // 3. Render Chart Initial State
  const datasets = [{
    label: `${identifier} ${mode === 'sector' ? '族群' : '題材'}`,
    data: sectorData.map(d => ({
      x: Math.max((d.amount / 100000000) || 0.1, 0.1), // Ensure x > 0 for log scale safety
      y: d.dailyReturn || 0,
      r: Math.max(4, Math.min((d.volume || 0) / 2000, 25)), 
      raw: d 
    })),
    backgroundColor: sectorData.map(d => 
      (d.dailyReturn || 0) >= 0 
        ? 'rgba(239, 68, 68, 0.75)'  // Red
        : 'rgba(34, 197, 94, 0.75)'  // Green
    ),
    borderColor: sectorData.map(d => 
      (d.dailyReturn || 0) >= 0 
        ? 'rgba(239, 68, 68, 1)' 
        : 'rgba(34, 197, 94, 1)'
    ),
    borderWidth: 1.5,
    hoverBorderWidth: 3,
    hoverBorderColor: '#fff'
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
      animation: {
        duration: 600,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          external: function(context) {
            const tooltipEl = document.getElementById('chart-tooltip');
            const tooltipModel = context.tooltip;
            
            if (tooltipModel.opacity === 0) {
              tooltipEl.style.opacity = 0;
              return;
            }

            if (tooltipModel.body) {
              const dataPoint = tooltipModel.dataPoints[0];
              const d = dataPoint.raw.raw;
              
              const returnSign = d.dailyReturn > 0 ? '+' : '';
              const returnColor = d.dailyReturn > 0 ? 'var(--positive-color)' : (d.dailyReturn < 0 ? 'var(--negative-color)' : 'white');
              const amountHundredMillion = (d.amount / 100000000).toFixed(2);
              
              const innerHtml = `
                <div style="margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">
                  <strong style="font-size: 1.1rem; color: #fff;">${d.stock['股票名稱']}</strong> 
                  <span style="color: #94a3b8; font-size: 0.9rem;">(${d.stock['股票代號']})</span>
                </div>
                <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 0.95rem;">
                  <span style="color: #94a3b8;">當日報酬:</span>
                  <span style="color: ${returnColor}; font-weight: bold; text-align: right;">${returnSign}${d.dailyReturn.toFixed(2)}%</span>
                  
                  <span style="color: #94a3b8;">成交量:</span>
                  <span style="color: #fff; text-align: right;">${d.volume.toLocaleString()} 張</span>
                  
                  <span style="color: #94a3b8;">成交額:</span>
                  <span style="color: #fff; text-align: right;">${amountHundredMillion} 億</span>
                </div>
                <div style="margin-top: 10px; font-size: 0.8rem; color: var(--accent-primary); text-align: center;">
                  👆 點擊查看技術線圖
                </div>
              `;
              
              tooltipEl.innerHTML = innerHtml;
            }

            const position = context.chart.canvas.getBoundingClientRect();
            
            let tooltipX = position.left + window.scrollX + tooltipModel.caretX + 15;
            let tooltipY = position.top + window.scrollY + tooltipModel.caretY - 15;
            
            tooltipEl.style.opacity = 1;
            tooltipEl.style.left = tooltipX + 'px';
            tooltipEl.style.top = tooltipY + 'px';
          }
        },
        datalabels: {
          color: 'rgba(255, 255, 255, 0.9)',
          font: { weight: 'bold', size: 12 },
          formatter: function(value) {
            return value.raw.stock['股票名稱'];
          },
          align: 'end',
          anchor: 'end',
          offset: 2,
          clip: false,
          display: function(context) {
            return context.dataset.data[context.dataIndex].r >= 8;
          }
        }
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          // Retrieve point from the chart's actual dataset array to guarantee consistency
          const point = chartInstance.data.datasets[0].data[index];
          const raw = point.raw;
          const symbol = raw.stock['股票代號'];
          const name = raw.stock['股票名稱'];
          const prefix = raw.stock['上市櫃']?.includes('上市') ? 'TW' : 'TWO';
          openKLinePanel(`${symbol}.${prefix}`, name);
        }
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: '成交金額 (億)', color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          title: { display: true, text: '報酬率 (%)', color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
  } catch (err) {
    console.error("Chart initialization failed:", err);
    return;
  }
}

// --- K-Line Logic ---
let lwChart = null;
let candleSeries = null;
let volumeSeries = null;

const klinePanel = document.getElementById('kline-panel');
const klineCloseBtn = document.getElementById('kline-close-btn');
const klineTitle = document.getElementById('kline-title');
const klineLoading = document.getElementById('kline-loading');
const klineContainer = document.getElementById('kline-chart-container');

klineCloseBtn.addEventListener('click', () => {
  klinePanel.classList.add('closed');
});

async function openKLinePanel(symbolWithSuffix, name) {
  klineTitle.textContent = `${name} (${symbolWithSuffix})`;
  klinePanel.classList.remove('closed');
  klineLoading.classList.remove('hidden');

  if (!lwChart) {
    initLwChart();
  } else {
    candleSeries.setData([]);
    volumeSeries.setData([]);
  }

  try {
    const res = await fetch(`/api/historical/${symbolWithSuffix}`);
    if (!res.ok) throw new Error('API failed');
    const data = await res.json();
    
    // Sort chronologically just in case
    data.sort((a, b) => new Date(a.time) - new Date(b.time));
    
    const candleData = data.map(d => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close
    }));
    
    const volumeData = data.map(d => ({
      time: d.time,
      value: d.value,
      color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
    }));

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    lwChart.timeScale().fitContent();
  } catch (error) {
    console.error('K-Line error:', error);
    klineTitle.textContent = `${name} - 載入失敗`;
  } finally {
    klineLoading.classList.add('hidden');
  }
}

function initLwChart() {
  lwChart = LightweightCharts.createChart(klineContainer, {
    layout: {
      background: { type: 'solid', color: 'transparent' },
      textColor: '#94a3b8',
    },
    grid: {
      vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
      horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
    rightPriceScale: {
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    timeScale: {
      borderColor: 'rgba(255, 255, 255, 0.1)',
      timeVisible: true,
    },
  });

  candleSeries = lwChart.addCandlestickSeries({
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
  });

  volumeSeries = lwChart.addHistogramSeries({
    color: '#26a69a',
    priceFormat: {
      type: 'volume',
    },
    priceScaleId: '', // overlay
  });
  
  volumeSeries.priceScale().applyOptions({
    scaleMargins: {
      top: 0.8, // leave top 80% for candles
      bottom: 0,
    },
  });

  // Handle resize
  new ResizeObserver(entries => {
    if (entries.length === 0 || entries[0].target !== klineContainer) { return; }
    const newRect = entries[0].contentRect;
    lwChart.applyOptions({ height: newRect.height, width: newRect.width });
  }).observe(klineContainer);
}

// Start app
init();
