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

export async function fetchSnapshot() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
    
    const response = await fetch('/api/snapshot', { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch snapshot:', error);
    showToast('無法取得即時資料，請檢查網路連線或稍後再試。');
    return null;
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
    return null; // Silent fail for historical, it might not exist yet
  }
}
