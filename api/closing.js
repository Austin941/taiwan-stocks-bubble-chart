// api/closing.js — 收盤價 (重構版)
// 改動：兩個 OpenAPI 各自獨立 fallback，不再因一方失敗導致全部 500
import { withCache, TTL } from './_lib/cache.js';

const TSE_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
const OTC_URL = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes';
const UA      = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function safeFetch(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    return res.ok ? await res.json() : [];
  } catch { return []; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, max-age=3600');

  try {
    const data = await withCache('closing:all', async () => {
      // 兩個 API 各自獨立抓取，任一失敗不影響另一個
      const [tseData, otcData] = await Promise.all([safeFetch(TSE_URL), safeFetch(OTC_URL)]);

      const cache = {};

      tseData.forEach(item => {
        const code  = item.Code?.trim();
        const close = parseFloat(String(item.ClosingPrice || '').replace(/,/g, ''));
        const chg   = parseFloat(String(item.Change      || '').replace(/,/g, ''));
        if (!code || !isFinite(close) || close <= 0) return;
        const prevClose = close - chg;
        cache[code] = { prevClose: prevClose > 0 ? prevClose : close };
      });

      otcData.forEach(item => {
        const code  = item.SecuritiesCompanyCode?.trim();
        const close = parseFloat(String(item.Close  || '').replace(/,/g, ''));
        const chg   = parseFloat(String(item.Change || '').replace(/,/g, ''));
        if (!code || !isFinite(close) || close <= 0) return;
        const prevClose = close - chg;
        cache[code] = { prevClose: prevClose > 0 ? prevClose : close };
      });

      if (Object.keys(cache).length === 0) throw new Error('Both TSE and OTC returned empty data');
      return cache;
    }, TTL.CLOSING);

    res.status(200).json({ data });
  } catch (err) {
    console.error('[closing] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch closing data', details: err.message });
  }
}
