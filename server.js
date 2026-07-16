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

const FUGLE_API_KEY = process.env.FUGLE_API_KEY;

// 1. Fugle API Proxy (High frequency, 60 req/min limit)
app.get('/api/fugle/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const response = await axios.get(`https://api.fugle.tw/marketdata/v1.0/stock/intraday/quote/${symbol}`, {
      headers: { 'X-API-KEY': FUGLE_API_KEY }
    });
    res.json(response.data);
  } catch (error) {
    console.error(`[Fugle Proxy] Error fetching ${req.params.symbol}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch Fugle data' });
  }
});

// 2. Market Snapshot (TWSE MIS API - Background Polling)
let marketCache = {};
let allSymbols = [];

// Read stocks from CSV
try {
  const csvPath = path.join(__dirname, 'public', 'stocks.csv');
  const csvData = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvData.split('\n').slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    const symbol = cols[0];
    const market = cols[3]; // '上市' or '上櫃'
    if (symbol && market) {
      // TWSE format: tse_2330.tw, OTC format: otc_6547.tw
      const prefix = market.includes('上市') ? 'tse' : 'otc';
      allSymbols.push(`${prefix}_${symbol}.tw`);
    }
  }
  console.log(`[Backend] Loaded ${allSymbols.length} symbols from dictionary.`);
} catch (e) {
  console.error('[Backend] Error loading CSV:', e.message);
}

// Background poller
let currentChunkIndex = 0;
const CHUNK_SIZE = 100; // TWSE MIS allows ~100 symbols per request

async function pollMarketData() {
  if (allSymbols.length === 0) return;

  const chunk = allSymbols.slice(currentChunkIndex, currentChunkIndex + CHUNK_SIZE);
  currentChunkIndex += CHUNK_SIZE;
  if (currentChunkIndex >= allSymbols.length) {
    currentChunkIndex = 0; // Wrap around
  }

  const queryUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${chunk.join('|')}&json=1&delay=0`;
  try {
    const response = await axios.get(queryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.data && response.data.msgArray) {
      response.data.msgArray.forEach(item => {
        if (item.c) { // symbol is in 'c'
          // Extract necessary fields: z=latest price, y=previous close, v=volume
          marketCache[item.c] = {
            price: parseFloat(item.z) || parseFloat(item.y), // use previous close if latest is null (e.g. before open)
            prevClose: parseFloat(item.y),
            volume: parseInt(item.v) || 0
          };
        }
      });
      // console.log(`[Backend] Updated snapshot chunk. Cache size: ${Object.keys(marketCache).length}`);
    }
  } catch (error) {
    console.error('[Backend] Error fetching MIS TWSE:', error.message);
  }
}

// Poll one chunk every 3 seconds
// Total 2000 stocks = 20 chunks = 60 seconds to update entire market
setInterval(pollMarketData, 3000);
pollMarketData(); // Start immediately

app.get('/api/snapshot', (req, res) => {
  res.json(marketCache);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[Backend] Server listening on port ${PORT}`);
});
