export default async function handler(req, res) {
  // Set CORS and Cache headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Cache at Vercel Edge for 1 hour, browser for 1 hour
  res.setHeader('Cache-Control', 'public, s-maxage=3600, max-age=3600');

  try {
    const [tseRes, otcRes] = await Promise.all([
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      }),
      fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      })
    ]);

    const tseData = await tseRes.json();
    const otcData = await otcRes.json();

    const cache = {};

    // Process TSE
    tseData.forEach(item => {
      const code = item.Code?.trim();
      const close = parseFloat(String(item.ClosingPrice || '').trim());
      const change = parseFloat(String(item.Change || '').trim());
      if (!code || isNaN(close) || close <= 0) return;

      const prevClose = close - change;
      cache[code] = {
        prevClose: prevClose > 0 ? prevClose : close
      };
    });

    // Process OTC
    otcData.forEach(item => {
      const code = item.SecuritiesCompanyCode?.trim();
      const close = parseFloat(String(item.Close || '').trim());
      const change = parseFloat(String(item.Change || '').trim());
      if (!code || isNaN(close) || close <= 0) return;

      const prevClose = close - change;
      cache[code] = {
        prevClose: prevClose > 0 ? prevClose : close
      };
    });

    res.status(200).json({ data: cache });
  } catch (error) {
    console.error('Closing API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch closing data' });
  }
}
