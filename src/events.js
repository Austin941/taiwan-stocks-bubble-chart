// ============================================================
// EVENTS — All addEventListener registrations in one place
// ============================================================
import { state } from './state.js';
import { switchView, showBubbleChart, renderTvWidget } from './views.js';
import { showChart, renderChart } from './chart.js';
import { switchPeriodTbody } from './dom.js';
import {
  renderRanking, renderThemeRanking, renderRadar, resortRadar,
  renderFlowRanking, renderDetailTable, renderHistoricalRanking,
} from './tables.js';

// Sort UI updaters (exported for init use)
const sortableHeaders      = document.querySelectorAll('.ranking-table th.sortable:not(.radar-sortable):not(.theme-sortable)');
const themeSortableHeaders = document.querySelectorAll('.theme-sortable');
const radarSortableHeaders = document.querySelectorAll('.radar-sortable');
const navBtns              = document.querySelectorAll('.sidebar-tab');
const backBtn              = document.getElementById('back-to-bubble-btn');

export function updateSortUI() {
  sortableHeaders.forEach(h => {
    const col  = h.getAttribute('data-sort');
    const icon = h.querySelector('.sort-icon');
    if (col === state.sortCol) { h.setAttribute('data-active', 'true'); icon.textContent = state.sortDesc ? '▼' : '▲'; }
    else { h.removeAttribute('data-active'); icon.textContent = ''; }
  });
}
export function updateThemeSortUI() {
  themeSortableHeaders.forEach(h => {
    const col  = h.getAttribute('data-sort');
    const icon = h.querySelector('.sort-icon');
    if (col === state.themeSortCol) { h.setAttribute('data-active', 'true'); icon.textContent = state.themeSortDesc ? '▼' : '▲'; }
    else { h.removeAttribute('data-active'); icon.textContent = ''; }
  });
}
export function updateRadarSortUI() {
  radarSortableHeaders.forEach(h => {
    const col  = h.getAttribute('data-sort');
    const icon = h.querySelector('.sort-icon');
    if (col === state.radarSortCol) { h.setAttribute('data-active', 'true'); icon.textContent = state.radarSortDesc ? '▼' : '▲'; }
    else { h.removeAttribute('data-active'); icon.textContent = ''; }
  });
}

// ---- Helper: get currently active sidebar tab target ----
function activeTabTarget() {
  return document.querySelector('.sidebar-tab.active')?.getAttribute('data-target') || 'view-ranking';
}

// ---- Register all events ----
export function initEvents(historicalPromise) {
  // Navigation tabs
  navBtns.forEach(btn => {
    btn.addEventListener('click', e => {
      const targetViewId = e.currentTarget.getAttribute('data-target');
      navBtns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      switchView(targetViewId);

      // Lazy render: only active tab
      if (state.currentPeriodDays !== 1 && state.historicalRanking?.[String(state.currentPeriodDays)]) {
        const pd = state.historicalRanking[String(state.currentPeriodDays)];
        if (targetViewId === 'view-ranking') {
          const orig = [...state.sectorRankingData];
          state.sectorRankingData = pd.sectors.filter(s => isFinite(s.avgReturn));
          renderRanking(`近 ${state.currentPeriodDays} 日排行`);
          state.sectorRankingData = orig;
        } else if (targetViewId === 'view-theme') {
          const orig = [...state.themeRankingData];
          state.themeRankingData = pd.themes.filter(t => isFinite(t.avgReturn));
          renderThemeRanking(`近 ${state.currentPeriodDays} 日排行`);
          state.themeRankingData = orig;
        } else if (targetViewId === 'view-radar') {
          state.currentRadarData = pd.radar || [];
          resortRadar();
        }
      } else if (state.currentPeriodDays === 1) {
        if (targetViewId === 'view-ranking') renderRanking();
        else if (targetViewId === 'view-theme') renderThemeRanking();
        else if (targetViewId === 'view-radar') renderRadar();
      }
    });
  });

  // Back button
  backBtn?.addEventListener('click', () => showBubbleChart(state.currentSector, state.currentChartMode));

  // Sector sort headers
  sortableHeaders.forEach(h => {
    h.addEventListener('click', () => {
      const col = h.getAttribute('data-sort');
      if (state.sortCol === col) state.sortDesc = !state.sortDesc;
      else { state.sortCol = col; state.sortDesc = true; }
      updateSortUI();
      if (state.currentPeriodDays === 1) {
        renderRanking();
      } else if (state.historicalRanking?.[String(state.currentPeriodDays)]) {
        const orig = [...state.sectorRankingData];
        state.sectorRankingData = state.historicalRanking[String(state.currentPeriodDays)].sectors.filter(s => isFinite(s.avgReturn));
        renderRanking(`近 ${state.currentPeriodDays} 日排行`);
        state.sectorRankingData = orig;
      }
    });
  });

  // Theme sort headers
  themeSortableHeaders.forEach(h => {
    h.addEventListener('click', () => {
      const col = h.getAttribute('data-sort');
      if (state.themeSortCol === col) state.themeSortDesc = !state.themeSortDesc;
      else { state.themeSortCol = col; state.themeSortDesc = true; }
      updateThemeSortUI();
      if (state.currentPeriodDays === 1) {
        renderThemeRanking();
      } else if (state.historicalRanking?.[String(state.currentPeriodDays)]) {
        const orig = [...state.themeRankingData];
        state.themeRankingData = state.historicalRanking[String(state.currentPeriodDays)].themes.filter(t => isFinite(t.avgReturn));
        renderThemeRanking(`近 ${state.currentPeriodDays} 日排行`);
        state.themeRankingData = orig;
      }
    });
  });

  // Radar sort headers
  radarSortableHeaders.forEach(h => {
    h.addEventListener('click', () => {
      const col = h.getAttribute('data-sort');
      if (state.radarSortCol === col) state.radarSortDesc = !state.radarSortDesc;
      else { state.radarSortCol = col; state.radarSortDesc = true; }
      updateRadarSortUI();
      if (state.currentPeriodDays !== 1 && state.currentRadarData.length) resortRadar();
      else renderRadar();
    });
  });

  // Period buttons
  document.querySelectorAll('#bubble-period-selector .period-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const days = parseInt(e.target.getAttribute('data-days'));
      if (state.currentPeriodDays === days) return;
      state.currentPeriodDays = days;

      // Update active class
      document.querySelectorAll('#bubble-period-selector .period-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.getAttribute('data-days')) === days);
      });

      // Switch period tbody for all views
      ['view-ranking', 'view-theme', 'view-radar'].forEach(v => switchPeriodTbody(v, days));

      // Re-render chart instantly
      if (state.currentSector) renderChart(state.currentSector, state.currentChartMode);

      // Lazy-render only the active tab
      const active = activeTabTarget();
      if (days === 1) {
        if (active === 'view-ranking') renderRanking();
        else if (active === 'view-theme') renderThemeRanking();
        else if (active === 'view-radar') renderRadar();
      } else if (historicalPromise) {
        document.getElementById('chart-loading-overlay').classList.remove('hidden');
        historicalPromise.then(() => {
          renderHistoricalRanking(state.currentPeriodDays);
          document.getElementById('chart-loading-overlay').classList.add('hidden');
        });
      }
    });
  });

  // Flow metric mode (Diff vs Abs) buttons
  document.querySelectorAll('#flow-metric-selector .size-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const mode = e.currentTarget.getAttribute('data-flow-mode');
      if (state.flowMetricMode === mode) return;
      state.flowMetricMode = mode;
      document.querySelectorAll('#flow-metric-selector .size-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-flow-mode') === mode);
      });

      // Update table amount header titles
      document.querySelectorAll('th[data-sort="amount"]').forEach(th => {
        const textNode = Array.from(th.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
        if (textNode) {
          textNode.textContent = mode === 'diff' ? '資金差值(億)' : '金額(億)';
        }
      });

      // Re-render active view
      const active = activeTabTarget();
      if (state.currentPeriodDays === 1) {
        if (active === 'view-ranking') renderRanking();
        else if (active === 'view-theme') renderThemeRanking();
        else if (active === 'view-radar') renderRadar();
      } else {
        renderHistoricalRanking(state.currentPeriodDays);
      }
      if (state.globalSectorDataForTable.length) renderDetailTable(state.globalSectorDataForTable);
    });
  });

  // Bubble size buttons
  document.querySelectorAll('#bubble-size-selector .size-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const mode = e.currentTarget.getAttribute('data-size-mode');
      if (state.currentSizeMode === mode) return;
      state.currentSizeMode = mode;
      document.querySelectorAll('#bubble-size-selector .size-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-size-mode') === mode);
      });
      if (state.currentSector) renderChart(state.currentSector, state.currentChartMode);
    });
  });

  // Detail table sort headers
  document.querySelectorAll('.detail-sortable').forEach(th => {
    th.addEventListener('click', () => {
      const column = th.getAttribute('data-sort');
      if (state.currentDetailSort.column === column) {
        state.currentDetailSort.order = state.currentDetailSort.order === 'desc' ? 'asc' : 'desc';
      } else {
        state.currentDetailSort.column = column;
        state.currentDetailSort.order  = 'desc';
      }
      document.querySelectorAll('.detail-sortable .sort-icon').forEach(i => { i.textContent = ''; i.classList.remove('asc', 'desc'); });
      const icon = document.getElementById(`detail-sort-${column}`);
      if (icon) { icon.textContent = state.currentDetailSort.order === 'desc' ? '▼' : '▲'; icon.classList.add(state.currentDetailSort.order); }
      if (state.globalSectorDataForTable.length) renderDetailTable(state.globalSectorDataForTable);
    });
  });

  // TradingView interval buttons
  document.querySelectorAll('#tech-interval-selector .interval-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      document.querySelectorAll('#tech-interval-selector .interval-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const symbol = document.getElementById('tech-chart-view').getAttribute('data-tv-symbol');
      if (symbol) renderTvWidget(symbol, e.target.getAttribute('data-interval'));
    });
  });

  // Detail table inline search
  const detailSearch = document.getElementById('detail-stock-search');
  if (detailSearch) {
    detailSearch.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      document.getElementById('detailTableBody')?.querySelectorAll('tr').forEach(tr => {
        tr.style.display = (!q || tr.textContent.toLowerCase().includes(q)) ? '' : 'none';
      });
    });
  }
}
