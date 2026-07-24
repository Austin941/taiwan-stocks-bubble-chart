export default async function handler(req, res) {
  // Allow CORS & Edge Cache for 5 minutes (300 seconds)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  const { symbol = '2330', days = '30' } = req.query;

  try {
    const cleanSymbol = symbol.replace('.TW', '').replace('.TWO', '').replace('TWSE:', '').replace('OTC:', '').trim();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (parseInt(days) || 30));
    const startDateStr = startDate.toISOString().split('T')[0];

    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockMarginPurchaseShortSale&data_id=${encodeURIComponent(cleanSymbol)}&start_date=${startDateStr}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`FinMind API HTTP error status: ${response.status}`);
    }

    const result = await response.json();
    const rawData = result.data || [];

    const formattedData = rawData.map(item => {
      const marginBalance = item.MarginPurchaseTodayBalance || 0; // 融資餘額
      const marginPrev = item.MarginPurchaseYesterdayBalance || 0;
      const marginChange = marginBalance - marginPrev;            // 融資增減

      const shortBalance = item.ShortSaleTodayBalance || 0;       // 融券餘額
      const shortPrev = item.ShortSaleYesterdayBalance || 0;
      const shortChange = shortBalance - shortPrev;              // 融券增減

      // 券資比 = (融券餘額 / 融資餘額) * 100%
      const ratio = marginBalance > 0 ? parseFloat(((shortBalance / marginBalance) * 100).toFixed(2)) : 0;

      // 軋空訊號警戒 (High Short-to-Margin Ratio > 20%)
      const isShortSqueezeAlert = ratio >= 20.0;

      return {
        date: item.date,
        symbol: cleanSymbol,
        marginBalance,
        marginChange,
        marginBuy: item.MarginPurchaseBuy || 0,
        marginSell: item.MarginPurchaseSell || 0,
        shortBalance,
        shortChange,
        shortBuy: item.ShortSaleBuy || 0,
        shortSell: item.ShortSaleSell || 0,
        offsetLoanAndShort: item.OffsetLoanAndShort || 0, // 資券相抵
        shortMarginRatioPercent: ratio,
        isShortSqueezeAlert
      };
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    const latest = formattedData[formattedData.length - 1] || {};

    res.status(200).json({
      success: true,
      symbol: cleanSymbol,
      count: formattedData.length,
      latestSummary: {
        date: latest.date || null,
        marginBalance: latest.marginBalance || 0,
        marginChange: latest.marginChange || 0,
        shortBalance: latest.shortBalance || 0,
        shortChange: latest.shortChange || 0,
        shortMarginRatioPercent: latest.shortMarginRatioPercent || 0,
        isShortSqueezeAlert: latest.isShortSqueezeAlert || false
      },
      data: formattedData
    });

  } catch (error) {
    console.error('Margin API Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch margin trading data',
      details: error.message
    });
  }
}
