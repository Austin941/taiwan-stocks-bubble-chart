const fs = require('fs');
const path = require('path');

const baseDir = path.join(process.cwd(), 'stock_dictionary');
if (!fs.existsSync(baseDir)) {
  fs.mkdirSync(baseDir, { recursive: true });
}

// 1. Copy CSV
const csvSrc = path.join(process.cwd(), 'public', 'stocks.csv');
const csvDst = path.join(baseDir, 'taiwan_stocks.csv');
fs.copyFileSync(csvSrc, csvDst);

// 2. Parse CSV
const csvData = fs.readFileSync(csvSrc, 'utf-8');
const lines = csvData.split('\n').filter(l => l.trim().length > 0);

const stockList = [];
const themeMap = {};
const sectorMap = {};

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(',');
  if (cols.length < 2) continue;
  const code = cols[0].trim();
  const name = cols[1].trim();
  const sector = cols[2] ? cols[2].trim() : '';
  const market = cols[3] ? cols[3].trim() : '';
  const listedDate = cols[4] ? cols[4].trim() : '';
  const isin = cols[5] ? cols[5].trim() : '';
  const themesStr = cols[6] ? cols[6].trim() : '';
  const themes = themesStr ? themesStr.split('、').map(t => t.trim()).filter(Boolean) : [];
  const themeCount = themes.length;

  const stockObj = {
    code,
    name,
    sector,
    market,
    listed_date: listedDate,
    isin,
    themes,
    theme_count: themeCount
  };

  stockList.push(stockObj);

  if (sector) {
    if (!sectorMap[sector]) sectorMap[sector] = { sector, count: 0, stocks: [] };
    sectorMap[sector].count++;
    sectorMap[sector].stocks.push({ code, name, market });
  }

  for (const t of themes) {
    if (!themeMap[t]) themeMap[t] = { theme: t, count: 0, stocks: [] };
    themeMap[t].count++;
    themeMap[t].stocks.push({ code, name, sector, market });
  }
}

// Write taiwan_stocks.json
fs.writeFileSync(path.join(baseDir, 'taiwan_stocks.json'), JSON.stringify(stockList, null, 2), 'utf-8');

// Write theme_taxonomy.json
const taxonomy = {
  updated_at: new Date().toISOString(),
  total_stocks: stockList.length,
  total_sectors: Object.keys(sectorMap).length,
  total_themes: Object.keys(themeMap).length,
  sectors: sectorMap,
  themes: themeMap
};
fs.writeFileSync(path.join(baseDir, 'theme_taxonomy.json'), JSON.stringify(taxonomy, null, 2), 'utf-8');

console.log(`[Success] Generated stock_dictionary with ${stockList.length} stocks, ${Object.keys(sectorMap).length} sectors, and ${Object.keys(themeMap).length} themes!`);
