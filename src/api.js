// src/api.js

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

export async function fetchSnapshot() {
  const MAX_RETRIES = 3;
  let delay = 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
      
      const response = await fetch('/api/snapshot', { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      // Reset fail count on success
      failCount = 0;
      return data;
    } catch (error) {
      console.warn(`[Snapshot] Fetch failed (Attempt ${attempt}/${MAX_RETRIES}):`, error);
      
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }

  // If we reach here, all retries failed
  failCount++;
  console.error('[Snapshot] All retries failed.');
  
  if (failCount >= 1) {
    showToast('無法取得即時資料，將自動切換為歷史模式。');
  }
  return null;
}

export async function fetchHistoricalRanking() {
  try {
    const response = await fetch('./historical_ranking.json?t=' + Date.now());
    if (!response.ok) throw new Error('Historical data not found');
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('No historical data available:', error);
    return null; // Silent fail for historical, it might not exist yet
  }
}
