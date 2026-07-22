// ============================================================
// STATE — Single source of truth for all mutable app state
// ============================================================
export const state = {
  // Data
  allStocks:            [],
  allMarketData:        [],
  sectorRankingData:    [],
  themeRankingData:     [],
  historicalRanking:    null,
  liveSnapshotCache:    {},
  globalSectorDataForTable: [],
  currentRadarData:     [],

  // Chart
  chartInstance:        null,
  activeTvWidget:       null,
  currentFetchId:       0,

  // Navigation & UI
  currentSector:        null,
  currentChartMode:     'sector',
  currentPeriodDays:    1,
  currentSizeMode:      'sqrt_amount', // 'sqrt_amount' | 'amount' | 'volume'
  currentDetailSort:    { column: 'amount', order: 'desc' },
  isMarketOpenNow:      false,

  // Sorting
  sortCol:        'amount',
  sortDesc:       true,
  radarSortCol:   'amount',
  radarSortDesc:  true,
  themeSortCol:   'amount',
  themeSortDesc:  true,
};
