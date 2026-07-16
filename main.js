import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Papa from 'papaparse';

Chart.register(ChartDataLabels);

// State
let allStocks = [];
let allMarketData = [];
let sectorRankingData = [];
let sectors = new Set();
let chartInstance = null;
let currentSector = '';

// Sorting State
let sortCol = 'amount'; // 'amount', 'volume', or 'return'
let sortDesc = true;

// DOM Elements
const viewRanking = document.getElementById('view-ranking');
const viewChart = document.getElementById('view-chart');
const rankingTableBody = document.getElementById('rankingTableBody');
const currentSectorTitle = document.getElementById('currentSectorTitle');
const canvas = document.getElementById('bubbleChart');
const backBtn = document.getElementById('backBtn');
const sortableHeaders = document.querySelectorAll('.sortable');

// Initialize
async function init() {
  try {
    const response = await fetch('./stocks.csv');
    const csvText = await response.text();
    
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        allStocks = results.data;
        processData();
      }
    });
  } catch (error) {
    console.error('Failed to load data:', error);
    rankingTableBody.innerHTML = '<tr><td colspan="5" class="text-center">載入資料失敗</td></tr>';
  }

  backBtn.addEventListener('click', () => {
    showView('ranking');
  });

  // Setup Sorting Listeners
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

  // Render Initial View
  updateSortUI();
  // Set up auto-refresh every 30 seconds for the Ranking view
  setInterval(() => {
    // Only refresh if we are currently looking at the ranking view
    if (currentSector === null) {
      processData();
    }
  }, 30000);
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
      // The TWSE backend returns { price, prevClose, volume }
      if (marketCache[symbol]) {
        const data = marketCache[symbol];
        price = data.price;
        volume = data.volume;
        if (data.prevClose && data.prevClose > 0) {
          dailyReturn = ((price - data.prevClose) / data.prevClose) * 100;
        }
        amount = price * volume * 1000; // rough estimation if real amount is not there
      } else {
        // Fallback for missing stocks (e.g., suspended or no trade)
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
  allMarketData.forEach(d => {
    const sector = d.stock['產業別'];
    if (!sector || sector === '無' || sector === '') return;
    
    if (!sectorMap[sector]) {
      sectorMap[sector] = {
        sector: sector,
        totalVolume: 0,
        totalAmount: 0,
        sumReturn: 0,
        count: 0
      };
    }
    sectorMap[sector].totalVolume += d.volume;
    sectorMap[sector].totalAmount += d.amount;
    sectorMap[sector].sumReturn += d.dailyReturn;
    sectorMap[sector].count += 1;
  });

    sectorRankingData = Object.keys(sectorMap).map(sector => {
      const data = sectorMap[sector];
      const avgReturn = data.sumReturn / (data.count || 1);
      return { sector, totalVolume: data.totalVolume, totalAmount: data.totalAmount, avgReturn };
    });

  // Render Ranking after processing data
  renderRanking();
  } catch(e) {
    console.error("Error processing data", e);
  }
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
        currentSector = sector;
        if(currentSectorTitle) currentSectorTitle.textContent = sector;
        showView('chart');
        renderChart(sector);
      }
    });
  });
}

function showView(viewName) {
  if (viewName === 'ranking') {
    viewRanking.classList.add('active');
    viewRanking.classList.remove('hidden');
    viewChart.classList.add('hidden');
    viewChart.classList.remove('active');
  } else if (viewName === 'chart') {
    viewChart.classList.add('active');
    viewChart.classList.remove('hidden');
    viewRanking.classList.add('hidden');
    viewRanking.classList.remove('active');
  }
}

async function renderChart(sector) {
  // Filter stocks in sector
  let sectorData = allMarketData.filter(d => d.stock['產業別'] === sector);
  
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
    label: `${sector} 族群`,
    data: sectorData.map(d => ({
      x: d.volume,
      y: d.dailyReturn,
      r: Math.max(5, Math.min(d.amount / 50000, 35)), 
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
          color: '#cbd5e1', // Slate-300
          font: {
            family: 'Inter, sans-serif',
            size: 11,
            weight: 600
          },
          align: 'bottom', // Put label under the bubble
          offset: 4,       // Add some spacing
          formatter: function(value, context) {
            return value.raw.stock['股票名稱']; // Access the stock name from raw data
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
          borderWidth: 1,
          padding: 12,
          boxPadding: 6,
          titleFont: { size: 16, weight: 'bold' },
          bodyFont: { size: 14 },
          displayColors: false,
          callbacks: {
            title: (context) => {
              const data = context[0].raw.raw;
              return `${data.stock['股票代號']} ${data.stock['股票名稱']}`;
            },
            label: (context) => {
              const data = context.raw.raw;
              return [
                `報酬率: ${data.dailyReturn > 0 ? '+' : ''}${data.dailyReturn.toFixed(2)}%`,
                `成交量: ${data.volume.toLocaleString()} 張`,
                `成交額: ${(data.amount / 10000).toFixed(2)} 億`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: '成交量 (張)',
            color: '#1e293b',
            font: { size: 16, weight: '600' }
          },
          ticks: {
            color: '#94a3b8',
            font: { size: 14 }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
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
