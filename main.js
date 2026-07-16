import Chart from 'chart.js/auto';
import Papa from 'papaparse';

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
const sectorSelect = document.getElementById('sectorSelect');
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
}

function processData() {
  // 1. Generate individual stock market data
  allMarketData = allStocks.map(stock => {
    const dailyReturn = (Math.random() * 20) - 10;
    const volume = Math.floor(Math.random() * 99000) + 1000;
    const amount = volume * (Math.random() * 50 + 10); 
    
    if (stock['產業別'] && stock['產業別'] !== '無' && stock['產業別'] !== '') {
      sectors.add(stock['產業別']);
    }

    return {
      stock,
      dailyReturn,
      volume,
      amount
    };
  });

  // 2. Aggregate data by sector
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

  sectorRankingData = Object.values(sectorMap).map(s => ({
    sector: s.sector,
    totalVolume: s.totalVolume,
    totalAmount: s.totalAmount,
    avgReturn: s.sumReturn / s.count
  }));

  // Populate Select
  const sortedSectors = Array.from(sectors).sort();
  sectorSelect.innerHTML = sortedSectors.map(s => `<option value="${s}">${s}</option>`).join('');

  // Setup Event Listeners
  sectorSelect.addEventListener('change', (e) => {
    currentSector = e.target.value;
    renderChart(currentSector);
  });

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
  renderRanking();
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
    const returnSign = d.avgReturn >= 0 ? '+' : '';
    
    return `
      <tr>
        <td>${index + 1}</td>
        <td><span class="badge-sector" data-sector="${d.sector}">${d.sector}</span></td>
        <td class="text-right ${returnClass}"><strong style="font-size:1.1rem">${returnSign}${d.avgReturn.toFixed(2)}%</strong></td>
        <td class="text-right">${d.totalVolume.toLocaleString()}</td>
        <td class="text-right"><strong style="color:var(--text-primary)">${(d.totalAmount / 10000).toFixed(2)}</strong></td>
      </tr>
    `;
  }).join('');

  // Add click events to sector badges
  document.querySelectorAll('.badge-sector').forEach(badge => {
    badge.addEventListener('click', (e) => {
      const sector = e.target.getAttribute('data-sector');
      if (sector) {
        currentSector = sector;
        sectorSelect.value = sector;
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

function renderChart(sector) {
  // Filter data for the selected sector
  const marketData = allMarketData.filter(d => d.stock['產業別'] === sector);

  const datasets = [{
    label: `${sector} 族群`,
    data: marketData.map(d => ({
      x: d.volume,
      y: d.dailyReturn,
      r: Math.max(5, Math.min(d.amount / 50000, 35)), 
      raw: d 
    })),
    backgroundColor: marketData.map(d => 
      d.dailyReturn >= 0 
        ? 'rgba(220, 38, 38, 0.65)'  // Red for positive (Taiwan)
        : 'rgba(22, 163, 74, 0.65)'  // Green for negative
    ),
    borderColor: marketData.map(d => 
      d.dailyReturn >= 0 
        ? 'rgba(220, 38, 38, 1)' 
        : 'rgba(22, 163, 74, 1)'
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
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#0f172a',
          bodyColor: '#334155',
          titleFont: { size: 16, weight: 'bold' },
          bodyFont: { size: 14, weight: '500' },
          padding: 14,
          borderColor: 'rgba(148, 163, 184, 0.4)',
          borderWidth: 1,
          displayColors: false,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
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
            font: { size: 14, weight: '500' },
            color: '#475569'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.06)'
          }
        },
        y: {
          title: {
            display: true,
            text: ['當', '日', '報', '酬', '率', '(%)'], // Vertical Text
            color: '#1e293b',
            font: { size: 15, weight: '700' }
          },
          ticks: {
            font: { size: 14, weight: '500' },
            color: '#475569'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.06)'
          }
        }
      }
    }
  });
}

// Start app
init();
