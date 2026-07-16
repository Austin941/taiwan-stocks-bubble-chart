import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import yahooFinance from 'yahoo-finance2';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const FUGLE_API_KEYS = process.env.FUGLE_API_KEYS 
  ? process.env.FUGLE_API_KEYS.split(',') 
  : [];
let currentKeyIndex = 0;

// 1. Fugle API Proxy (High frequency, load balanced across multiple keys)
app.get('/api/fugle/:symbol', async (req, res) => {
  if (FUGLE_API_KEYS.length === 0) {
    return res.status(500).json({ error: 'No Fugle API Keys configured' });
  }

  // Round-robin key selection
  const apiKey = FUGLE_API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % FUGLE_API_KEYS.length;

  try {
    const { symbol } = req.params;
    const response = await axios.get(`https://api.fugle.tw/marketdata/v1.0/stock/intraday/quote/${symbol}`, {
      headers: { 'X-API-KEY': apiKey }
    });
    res.json(response.data);
  } catch (error) {
    console.error(`[Fugle Proxy] Error fetching ${req.params.symbol} with key index ${currentKeyIndex}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch Fugle data' });
  }
});

// 2. Market Snapshot (Concurrent Fetch with Market Hours Logic)
let marketCache = {};
let allSymbols = [];
let lastCacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds

// Read stocks from CSV
try {
  const csvPath = path.join(__dirname, 'public', 'stocks.csv');
  const csvData = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvData.split('\n').slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    const symbol = cols[0];
    const market = cols[3];
    if (symbol && market) {
      const prefix = market.includes('上市') ? 'tse' : 'otc';
      allSymbols.push(`${prefix}_${symbol}.tw`);
    }
  }
  console.log(`[Backend] Loaded ${allSymbols.length} symbols from dictionary.`);
} catch (e) {
  console.error('[Backend] Error loading CSV:', e.message);
}

function isMarketOpen() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const time = now.getHours() * 60 + now.getMinutes();
  // Taiwan Stock Market Open + After-market: 08:30 to 14:30
  return time >= 510 && time <= 870;
}

async function fetchEntireMarket() {
  if (allSymbols.length === 0) return;
  
  const CHUNK_SIZE = 100;
  const promises = [];
  
  for (let i = 0; i < allSymbols.length; i += CHUNK_SIZE) {
    const chunk = allSymbols.slice(i, i + CHUNK_SIZE);
    const queryUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${chunk.join('|')}&json=1&delay=0`;
    
    promises.push(
      axios.get(queryUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 5000
      }).then(response => {
        if (response.data && response.data.msgArray) {
          response.data.msgArray.forEach(item => {
            if (item.c) {
              marketCache[item.c] = {
                price: parseFloat(item.z) || parseFloat(item.y),
                prevClose: parseFloat(item.y),
                volume: parseInt(item.v) || 0
              };
            }
          });
        }
      }).catch(err => console.error('[Backend] Fetch Chunk Error:', err.message))
    );
  }
  
  await Promise.all(promises);
  lastCacheTime = Date.now();
  console.log(`[Backend] Fetched full market snapshot. Cache size: ${Object.keys(marketCache).length}. Market Open: ${isMarketOpen()}`);
}

app.get('/api/snapshot', async (req, res) => {
  const now = Date.now();
  
  // Fetch if cache is empty OR (market is open AND cache is older than TTL)
  const needsUpdate = (Object.keys(marketCache).length === 0) || (isMarketOpen() && (now - lastCacheTime > CACHE_TTL));
  
  if (needsUpdate) {
    await fetchEntireMarket();
  }
  
  res.json({
    data: marketCache,
    isMarketOpen: isMarketOpen(),
    timestamp: lastCacheTime
  });
});

// 3. Historical Data for K-Line Chart
app.get('/api/historical/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    // Get last 6 months
    const period1 = new Date();
    period1.setMonth(period1.getMonth() - 6);
    
    const queryOptions = { period1, interval: '1d' };
    const result = await yahooFinance.historical(symbol, queryOptions);
    
    // Format for Lightweight Charts: { time: 'yyyy-mm-dd', open, high, low, close, value (volume) }
    const formatted = result.map(d => ({
      time: d.date.toISOString().split('T')[0],
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      value: d.volume / 1000 // Convert shares to 張
    }));
    res.json(formatted);
  } catch (error) {
    console.error(`[Backend] Error fetching historical data for ${req.params.symbol}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

// 4. Period Analysis for Historical Bubble Chart
app.post('/api/period_analysis', async (req, res) => {
  try {
    const { symbols, days } = req.body;
    if (!symbols || !Array.isArray(symbols) || !days) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    
    const period1 = new Date();
    period1.setDate(period1.getDate() - (days + 20)); // Add buffer for weekends/holidays
    
    const results = {};
    const CHUNK_SIZE = 10;
    
    for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
      const chunk = symbols.slice(i, i + CHUNK_SIZE);
      const promises = chunk.map(async (symbol) => {
        try {
          // Add .TW or .TWO suffix. (Usually our UI passes them without suffix if it's from stocks.csv, 
          // we need to determine if it's TW or TWO. But Yahoo Finance mostly accepts .TW for TSE and .TWO for OTC.
          // Wait, the client will pass the exact YF symbol if we format it, or just the number.)
          // Let's assume client passes "2330.TW"
          const hist = await yahooFinance.historical(symbol, { period1, interval: '1d' });
          const recent = hist.slice(-days);
          if (recent.length === 0) return null;
          
          const startClose = recent[0].close || recent[0].open;
          const endClose = recent[recent.length - 1].close;
          const cumulativeReturn = startClose ? ((endClose - startClose) / startClose) * 100 : 0;
          
          let totalVolume = 0;
          let totalAmount = 0;
          for (const day of recent) {
            const vol = day.volume / 1000;
            totalVolume += vol;
            totalAmount += (vol * day.close * 1000); // TWD
          }
          
          // Provide symbol without suffix for matching
          const baseSymbol = symbol.split('.')[0];
          results[baseSymbol] = {
            cumulativeReturn,
            totalVolume,
            totalAmount
          };
        } catch (e) {
          // ignore failed symbols
        }
      });
      await Promise.all(promises);
      if (i + CHUNK_SIZE < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 300)); // Rate limit buffer
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error('[Backend] Error in period analysis:', error.message);
    res.status(500).json({ error: 'Failed to analyze period' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[Backend] Server listening on port ${PORT}`);
});
