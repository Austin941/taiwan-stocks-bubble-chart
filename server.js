import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

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
// API 1 — TWSE mis.twse.com.tw (即時盤中 - Real-time Intraday)
// Handles: TSE + OTC in a single API (100 symbols per request)
// Field guide:
//   z = last transaction price (can be "-" if no trade yet)
//   y = yesterday close price
//   o = today open
//   h = today high
//   l = today low
//   v = volume (張)
// ============================================================
async function fetchIntraday() {
  const CHUNK_SIZE = 1000;
  const promises = [];

  for (let i = 0; i < yfSymbols.length; i += CHUNK_SIZE) {
    const chunk = yfSymbols.slice(i, i + CHUNK_SIZE);
    promises.push(
      yahooFinance.quote(chunk)
        .then(results => {
          results.forEach(quote => {
            const code = quote.symbol.split('.')[0];
            const price = quote.regularMarketPrice;
            const prevClose = quote.regularMarketPreviousClose;
            const volume = (quote.regularMarketVolume || 0) / 1000; // Convert to 張

            if (code && price && prevClose > 0) {
              marketCache[code] = {
                price: price,
                prevClose: prevClose,
                volume: Math.round(volume)
              };
            }
          });
        })
        .catch(err => console.error('[Intraday] Yahoo fetch error:', err.message))
    );
  }

  await Promise.all(promises);
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
      const close = parseFloat(item.ClosingPrice?.replace(/,/g, ''));
      const change = parseFloat(item.Change?.replace(/,/g, ''));
      const vol = parseFloat(item.TradeVolume?.replace(/,/g, '')) / 1000; // Convert to 張
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
      const close = parseFloat(item.Close?.trim());
      const change = parseFloat(item.Change?.trim());
      const vol = parseFloat(item.TradingShares?.replace(/,/g, '')) / 1000; // Convert to 張
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
  if (isMarketOpen()) {
    // Real-time: TWSE mis (all symbols in parallel chunks)
    await fetchIntraday();
  } else {
    // After close: use both official closing APIs concurrently
    await Promise.all([fetchTSEClosing(), fetchOTCClosing()]);
  }
}

// ============================================================
// SNAPSHOT ENDPOINT
// ============================================================
app.get('/api/snapshot', async (req, res) => {
  const now = Date.now();
  const ttl = isMarketOpen() ? INTRADAY_TTL : CLOSING_TTL;
  const needsUpdate = Object.keys(marketCache).length === 0 || (now - lastCacheTime > ttl);

  if (needsUpdate) {
    await fetchMarketData();
  }

  res.json({
    data: marketCache,
    isMarketOpen: isMarketOpen(),
    timestamp: lastCacheTime
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
// START SERVER OR EXPORT FOR VERCEL
// ============================================================
const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`[Backend] Server listening on port ${PORT}`);
    // Pre-warm the cache on startup
    fetchMarketData().catch(e => console.error('[Backend] Pre-warm error:', e.message));
  });
}

export default app;
