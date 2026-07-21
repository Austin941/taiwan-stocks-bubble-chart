import express from 'express';
import cors from 'cors';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import https from 'https';

// Keep-Alive Agent to drastically reduce TLS handshake latency for multiple requests
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// STOCK DICTIONARY
// ============================================================
let allSymbols = [];     // ['tse_2330.tw', 'otc_6547.tw', ...]
let tseSymbols = [];     // only TSE (上市)
let otcSymbols = [];     // only OTC (上櫃)
let yfSymbols = [];      // ['2330.TW', '6547.TWO'] for Yahoo Finance

try {
  const csvPath = path.join(__dirname, 'public', 'stocks.csv');
  const csvData = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvData.split('\n').slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    const symbol = cols[0]?.trim();
    const market  = cols[3]?.trim();
    if (!symbol || !market) continue;
    if (market.includes('上市')) {
      allSymbols.push(`tse_${symbol}.tw`);
      tseSymbols.push(symbol);
      yfSymbols.push(`${symbol}.TW`);
    } else {
      allSymbols.push(`otc_${symbol}.tw`);
      otcSymbols.push(symbol);
      yfSymbols.push(`${symbol}.TWO`);
    }
  }
  console.log(`[Backend] Loaded ${tseSymbols.length} TSE + ${otcSymbols.length} OTC symbols.`);
} catch (e) {
  console.error('[Backend] Error loading CSV:', e.message);
}

// ============================================================
// MARKET HOURS
// ============================================================
function isMarketOpen() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const time = now.getHours() * 60 + now.getMinutes();
  // Market trades until 13:30 (after-hours matching until 14:30).
  // However, official OpenAPI doesn't update until ~15:30-16:00.
  // We keep using TWSE MIS API until 16:30 to ensure we don't fetch yesterday's data.
  return time >= 510 && time <= 990; // 08:30 ~ 16:30
}

// ============================================================
// CACHE
// ============================================================
let marketCache = {};
let lastCacheTime = 0;
const INTRADAY_TTL  = 8000;  // 8 seconds during market hours
const CLOSING_TTL   = 3600000; // 1 hour after close

// ============================================================
// API 1: Yahoo Finance (Real-time Intraday Replacement)
// ============================================================
async function fetchIntraday() {
  const CHUNK_SIZE = 500; // Yahoo can handle large chunks easily
  let updatedCount = 0;

  // Convert local symbols to Yahoo Finance format
  const yfSymbolsMap = {}; // Maps Yahoo symbol -> Local symbol (e.g. 2330.TW -> tse_2330.tw)
  const yfQueries = [];

  tseSymbols.forEach(s => {
    const yf = `${s}.TW`;
    yfSymbolsMap[yf] = `tse_${s}.tw`;
    yfQueries.push(yf);
  });
  
  otcSymbols.forEach(s => {
    const yf = `${s}.TWO`;
    yfSymbolsMap[yf] = `otc_${s}.tw`;
    yfQueries.push(yf);
  });

  for (let i = 0; i < yfQueries.length; i += CHUNK_SIZE) {
    const chunk = yfQueries.slice(i, i + CHUNK_SIZE);
    try {
      const quotes = await yahooFinance.quote(chunk);
      
      quotes.forEach(q => {
        const localSymbol = yfSymbolsMap[q.symbol];
        if (!localSymbol) return;

        let price = q.regularMarketPrice;
        let volume = q.regularMarketVolume || 0;
        let prevClose = q.regularMarketPreviousClose;

        // If marketCache already has the TRUE prevClose from OpenAPI, USE IT!
        if (marketCache[localSymbol] && marketCache[localSymbol].prevClose > 0) {
          prevClose = marketCache[localSymbol].prevClose;
        }

        if (!price || price <= 0) {
          if (marketCache[localSymbol] && marketCache[localSymbol].price > 0) {
            price = marketCache[localSymbol].price;
          } else {
            price = prevClose;
          }
        }

        if (prevClose > 0) {
          marketCache[localSymbol] = { price, prevClose, volume };
          updatedCount++;
        }
      });
    } catch (err) {
      console.error(`[Intraday] Yahoo chunk error (index ${i}):`, err.message);
    }
  }

  lastCacheTime = Date.now();
  console.log(`[Intraday] Updated via Yahoo Finance. Cache size: ${Object.keys(marketCache).length}`);
}

// ============================================================
// API 2 — TWSE OpenAPI (收盤後精確數據 - TSE Closing Data)
// URL: https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL
// Fields: Code, ClosingPrice, Change, TradeVolume, TradeValue
// ============================================================
async function fetchTSEClosing() {
  try {
    const res = await axios.get('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', {
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    });
    const data = res.data;
    if (!Array.isArray(data)) return;

    let updated = 0;
    data.forEach(item => {
      const code = item.Code?.trim();
      const close = parseFloat(String(item.ClosingPrice || '').replace(/,/g, ''));
      const change = parseFloat(String(item.Change || '').replace(/,/g, ''));
      const vol = parseFloat(String(item.TradeVolume || '').replace(/,/g, '')) / 1000; // Convert to 張
      if (!code || isNaN(close) || close <= 0) return;

      const prevClose = close - change;
      marketCache[code] = {
        price: close,
        prevClose: prevClose > 0 ? prevClose : close,
        volume: isNaN(vol) ? 0 : Math.round(vol)
      };
      updated++;
    });
    console.log(`[TSE-Closing] Updated ${updated} TSE stocks.`);
  } catch (e) {
    console.error('[TSE-Closing] Error:', e.message);
  }
}

// ============================================================
// API 3 — TPEx OpenAPI (收盤後精確數據 - OTC Closing Data)
// URL: https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes
// Fields: SecuritiesCompanyCode, Close, Change, TradingShares, TransactionAmount
// ============================================================
async function fetchOTCClosing() {
  try {
    const res = await axios.get('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes', {
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    });
    const data = res.data;
    if (!Array.isArray(data)) return;

    let updated = 0;
    data.forEach(item => {
      const code = item.SecuritiesCompanyCode?.trim();
      const close = parseFloat(String(item.Close || '').trim());
      const change = parseFloat(String(item.Change || '').trim());
      const vol = parseFloat(String(item.TradingShares || '').replace(/,/g, '')) / 1000; // Convert to 張
      if (!code || isNaN(close) || close <= 0) return;

      const prevClose = close - change;
      marketCache[code] = {
        price: close,
        prevClose: prevClose > 0 ? prevClose : close,
        volume: isNaN(vol) ? 0 : Math.round(vol)
      };
      updated++;
    });
    console.log(`[OTC-Closing] Updated ${updated} OTC stocks.`);
  } catch (e) {
    console.error('[OTC-Closing] Error:', e.message);
  }
}

// ============================================================
// SMART FETCH DISPATCHER
// During market hours: use real-time intraday API
// After close: use official closing price APIs (more accurate)
// ============================================================
async function fetchMarketData() {
  // If cache is empty, we must fetch the official closing data FIRST to establish true prevClose,
  // regardless of whether market is open or not.
  if (Object.keys(marketCache).length === 0) {
    console.log('[Dispatcher] Initializing cache with official EOD data...');
    await Promise.all([fetchTSEClosing(), fetchOTCClosing()]);
  }

  if (isMarketOpen()) {
    // Real-time: Yahoo Finance (since TWSE blocks Render IP)
    await fetchIntraday();
  } else {
    // After close: update again using official closing APIs (more accurate than Yahoo)
    await Promise.all([fetchTSEClosing(), fetchOTCClosing()]);
  }
}

// ============================================================
// SNAPSHOT ENDPOINT
// ============================================================
// ============================================================
// SNAPSHOT ENDPOINT (PURE READ-ONLY)
// ============================================================
app.get('/api/snapshot', (req, res) => {
  res.json({
    data: marketCache,
    isMarketOpen: isMarketOpen(),
    timestamp: lastCacheTime,
    stale: Date.now() - lastCacheTime > 60000 // if >1 min old, considered stale
  });
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    cacheSize: Object.keys(marketCache).length,
    lastUpdate: new Date(lastCacheTime).toISOString(),
    isMarketOpen: isMarketOpen(),
    tseCount: tseSymbols.length,
    otcCount: otcSymbols.length
  });
});

// ============================================================
// BACKGROUND POLLING & STATIC SERVING
// ============================================================
// Serve static frontend files from 'dist' directory (for Render)
app.use(express.static(path.join(__dirname, 'dist')));

// Also serve public folder just in case
app.use(express.static(path.join(__dirname, 'public')));

let isFetching = false;
async function backgroundFetchLoop() {
  if (isFetching) return;
  isFetching = true;
  try {
    const ttl = isMarketOpen() ? INTRADAY_TTL : CLOSING_TTL;
    if (Date.now() - lastCacheTime > ttl || Object.keys(marketCache).length === 0) {
      await fetchMarketData();
    }
  } catch (err) {
    console.error('[Background] Fetch error:', err.message);
  } finally {
    isFetching = false;
  }
}

// Start background loop every 5 seconds
setInterval(backgroundFetchLoop, 5000);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[Backend] Server listening on port ${PORT}`);
  // Pre-warm the cache immediately on startup
  backgroundFetchLoop();
});

export default app;
