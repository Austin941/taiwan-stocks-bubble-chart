let toastTimeout;

export function showToast(message, type = 'error') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>⚠️</span> <span>${message}</span>`;
  
  container.appendChild(toast);

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 300);
  }, 5000);
}

let failCount = 0;
let closingCache = null;

// Helper to split array into chunks
function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export async function fetchSnapshot(allStocks = []) {
  try {
    // 1. Fetch closing data once to get true prevClose
    if (!closingCache) {
      console.log('[Snapshot] Fetching EOD closing data...');
      const closingRes = await fetch('/api/closing');
      if (closingRes.ok) {
        const data = await closingRes.json();
        closingCache = data.data || {};
      } else {
        closingCache = {};
      }
    }

    if (!allStocks || allStocks.length === 0) {
      return { data: closingCache, isMarketOpen: true };
    }

    // 2. Build TWSE MIS symbols list
    const misSymbols = allStocks.map(stock => {
      const code = stock['股票代號'];
      const market = stock['市場別'];
      if (market && market.includes('上市')) {
        return `tse_${code}.tw`;
      } else {
        return `otc_${code}.tw`;
      }
    });

    // 3. Split into chunks of 100
    const chunks = chunkArray(misSymbols, 100);
    const finalCache = {};

    // 4. Fetch all chunks in parallel through Vercel Proxy
    const fetchPromises = chunks.map(async (chunk) => {
      try {
        const queryStr = chunk.join('|');
        const res = await fetch(`/api/proxy?symbols=${queryStr}`);
        if (!res.ok) return;
        
        const data = await res.json();
        if (data && data.msgArray) {
          data.msgArray.forEach(item => {
            const code = item.c; // symbol like 2330
            if (!code) return;

            let prevClose = parseFloat(item.y) || 0;
            // Only use closingCache if item.y is missing or 0 (e.g., newly listed stocks)
            if (prevClose <= 0 && closingCache[code] && closingCache[code].prevClose > 0) {
              prevClose = closingCache[code].prevClose;
            }

            let price = parseFloat(item.z);
            if (isNaN(price) || price <= 0) {
               // Fallback 1: Simulated matching price
               if (item.pz && item.pz !== '-') {
                 price = parseFloat(item.pz);
               } 
               // Fallback 2: Average of best bid/ask
               else if (item.a && item.b && item.a !== '-' && item.b !== '-') {
                 const ask = parseFloat(item.a.split('_')[0]);
                 const bid = parseFloat(item.b.split('_')[0]);
                 if (!isNaN(ask) && !isNaN(bid)) {
                   price = (ask + bid) / 2;
                 }
               }
               
               // Fallback 3: If still no live price, use previous close (0% return)
               if (isNaN(price) || price <= 0) {
                 price = prevClose;
               }
            }

            const volume = parseInt(item.v) || 0;
            
            if (prevClose > 0) {
              finalCache[code] = { price, prevClose, volume };
            }
          });
        }
      } catch (err) {
        console.warn('[Snapshot] Chunk proxy failed:', err);
      }
    });

    await Promise.all(fetchPromises);

    failCount = 0;
    
    // If proxy completely failed (e.g. offline), fallback to closingCache
    if (Object.keys(finalCache).length === 0) {
      return { data: closingCache, isMarketOpen: true };
    }

    return { data: finalCache, isMarketOpen: true };

  } catch (error) {
    failCount++;
    console.error('[Snapshot] All retries failed:', error);
    if (failCount >= 1) {
      showToast('無法取得最新資料，將顯示歷史模式。');
    }
    return { data: closingCache || {}, isMarketOpen: false };
  }
}

export async function fetchHistoricalRanking() {
  try {
    const response = await fetch('./historical_ranking.json?t=' + Date.now());
    if (!response.ok) throw new Error('Historical data not found');
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('No historical data available:', error);
    return null; 
  }
}
