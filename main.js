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
const currentSectorTitle = document.getElementById('currentSectorTitle');
const canvas = document.getElementById('bubbleChart');
const backBtn = document.getElementById('backBtn');
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

function renderRanking() {
  // Sort aggregated sector data
  const sortedData = [...sectorRankingData].sort((a, b) => {
    let valA, valB;
    if (sortCol === 'volume') {
      valA = a.totalVolume; valB = b.totalVolume;
    } else if (sortCol === 'return') {
      valA = a.avgReturn; valB = b.avgReturn;
    } else {
      valA = a.totalAmount; valB = b.totalAmount;
    }
    return sortDesc ? valB - valA : valA - valB;
  });

  rankingTableBody.innerHTML = sortedData.map((d, index) => {
    const returnClass = d.avgReturn >= 0 ? 'color-positive' : 'color-negative';
    const flashClass = d.avgReturn >= 0 ? 'flash-up' : 'flash-down';
    const returnSign = d.avgReturn >= 0 ? '+' : '';
    
    return `
      <tr data-sector="${d.sector}" class="${flashClass}">
        <td>${index + 1}</td>
        <td><span class="badge-sector">${d.sector}</span></td>
        <td class="text-right ${returnClass}"><strong style="font-size:1.1rem">${returnSign}${d.avgReturn.toFixed(2)}%</strong></td>
        <td class="text-right">${d.totalVolume.toLocaleString()}</td>
        <td class="text-right"><strong style="color:var(--text-primary)">${(d.totalAmount / 10000).toFixed(2)}</strong></td>
      </tr>
    `;
  }).join('');

  // Add click events to entire row
  document.querySelectorAll('.ranking-table tbody tr').forEach(row => {
    row.addEventListener('click', (e) => {
      const sector = row.getAttribute('data-sector');
      if (sector) {
        showChart(sector, 'sector');
      }
    });
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
  
  renderChart(identifier, mode);
}

async function renderChart(identifier, mode) {
  // Filter stocks
  let sectorData = [];
  if (mode === 'sector') {
    sectorData = allMarketData.filter(d => d.stock['產業別'] === identifier);
  } else {
    sectorData = allMarketData.filter(d => {
      const themes = d.stock['題材清單'];
      return themes && themes.includes(identifier);
    });
  }
  
  // Filter out zero amount/volume stocks to prevent logarithmic scale errors and reduce noise
  sectorData = sectorData.filter(d => d.amount > 0 && d.volume > 0);
  
  // To avoid hitting Fugle limits (we now have 5 API keys = 300 req/min), 
  // we pick the top 50 most traded stocks in this sector
  // to fetch real-time high-frequency data, while the rest uses the snapshot.
  sectorData.sort((a, b) => b.volume - a.volume);
  const top50 = sectorData.slice(0, 50);
  
  // Try to fetch real-time Fugle quotes for top 50
  await Promise.all(top50.map(async (d) => {
    if(d.volume === 0 && d.price === 0) return; // skip inactive
    try {
      const res = await fetch(`/api/fugle/${d.stock['股票代號']}`);
      const quote = await res.json();
      if(quote && quote.changePercent !== undefined) {
        d.dailyReturn = quote.changePercent;
        d.volume = quote.total ? quote.total.tradeVolume : d.volume;
        d.amount = quote.total ? quote.total.tradeValue : d.amount;
        d.price = quote.lastPrice || quote.closePrice || d.price;
      }
    } catch(e) {
      console.error('Fugle API error for', d.stock['股票代號']);
    }
  }));

  const datasets = [{
    label: `${identifier} 族群`,
    data: sectorData.map(d => ({
      x: d.amount / 100000000, // X 軸：成交金額 (億)
      y: d.dailyReturn,        // Y 軸：漲跌幅
      r: Math.max(4, Math.min(d.volume / 2000, 25)), // R：成交量 (張數)
      raw: d 
    })),
    backgroundColor: sectorData.map(d => 
      d.dailyReturn >= 0 
        ? 'rgba(239, 68, 68, 0.75)'  // Dark theme Red
        : 'rgba(34, 197, 94, 0.75)'  // Dark theme Green
    ),
    borderColor: sectorData.map(d => 
      d.dailyReturn >= 0 
        ? 'rgba(239, 68, 68, 1)' 
        : 'rgba(34, 197, 94, 1)'
    ),
    borderWidth: 1.5,
    hoverBorderWidth: 3,
    hoverBorderColor: '#fff'
  }];

  if (chartInstance) {
    chartInstance.destroy();
  }

  Chart.defaults.color = '#475569'; // Light theme text color
  Chart.defaults.font.family = 'Inter, sans-serif';

  chartInstance = new Chart(canvas, {
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
        datalabels: {
          color: 'rgba(255, 255, 255, 0.9)',
          font: {
            family: 'Inter',
            size: 11,
            weight: 'bold'
          },
          align: 'bottom',
          offset: window.innerWidth < 768 ? 2 : 4,
          formatter: function(value, context) {
            // 只顯示成交量最大的前幾名，避免重疊
            const limit = window.innerWidth < 768 ? 5 : 10;
            if (context.dataIndex >= limit) {
              return null;
            }
            return value.raw.stock['股票名稱'];
          }
        },
        legend: {
          labels: {
            color: '#f8fafc'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          backgroundColor: 'hsla(219, 44%, 12%, 0.9)', // deep midnight blue
          titleFont: { size: 16, weight: 'bold', family: 'Inter' },
          bodyFont: { size: 14, family: 'Inter' },
          borderColor: 'hsla(199, 89%, 48%, 0.5)',
          borderWidth: 1,
          padding: 14,
          displayColors: false,
          cornerRadius: 8,
          boxPadding: 6,
          callbacks: {
            title: function(context) {
              const d = context[0].raw.raw;
              return `${d.stock['股票名稱']} (${d.stock['股票代號']})`;
            },
            label: function(context) {
              const d = context.raw.raw;
              const returnSign = d.dailyReturn > 0 ? '+' : '';
              const amountHundredMillion = (d.amount / 10000).toFixed(2);
              return [
                `漲跌幅: ${returnSign}${d.dailyReturn.toFixed(2)}%`,
                `成交量: ${d.volume.toLocaleString()} 張`,
                `成交額: ${amountHundredMillion} 億`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          type: 'logarithmic',
          title: {
            display: true,
            text: '成交金額 (億) - 對數級距',
            color: 'rgba(255, 255, 255, 0.7)'
          },
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: 'rgba(255, 255, 255, 0.7)' }
        },
        y: {
          title: {
            display: false
          },
          ticks: {
            color: '#94a3b8',
            font: { size: 14 }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      }
    }
  });
}

// Start app
init();
