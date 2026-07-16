const fs = require('fs');
const readline = require('readline');

async function analyze() {
  const fileStream = fs.createReadStream('c:/Users/user/OneDrive/桌面/台股字典/stock_data_v5/all_stocks_final_v5.csv');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let isHeader = true;
  let headers = [];
  let rows = [];

  for await (const line of rl) {
    if (isHeader) {
      headers = line.split(',');
      isHeader = false;
      continue;
    }
    const cols = line.split(',');
    if (cols.length > 0 && cols[0] !== '') {
      rows.push(cols);
    }
  }

  const report = {
    totalRows: rows.length,
    duplicateIds: [],
    missingSectors: [],
    malformedRows: [],
    sectorsCount: {},
    tsmc: null
  };

  const idSet = new Set();

  rows.forEach((row, index) => {
    // Check malformed
    if (row.length !== headers.length) {
      report.malformedRows.push({ line: index + 2, data: row });
    }

    const id = row[0];
    const name = row[1];
    const sector = row[2];

    // Check duplicates
    if (idSet.has(id)) {
      report.duplicateIds.push(id);
    }
    idSet.add(id);

    // Check missing sector
    if (!sector || sector.trim() === '' || sector.trim() === '無') {
      report.missingSectors.push({ id, name });
    } else {
      report.sectorsCount[sector] = (report.sectorsCount[sector] || 0) + 1;
    }

    // Check TSMC
    if (id === '2330') {
      report.tsmc = { id, name, sector };
    }
  });

  fs.writeFileSync('c:/Users/user/OneDrive/桌面/泡泡圖/analysis_result.json', JSON.stringify(report, null, 2));
  console.log('Analysis complete. Wrote to analysis_result.json');
}

analyze();
