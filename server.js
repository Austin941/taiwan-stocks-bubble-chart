import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[Backend] Server listening on port ${PORT}`);
});
