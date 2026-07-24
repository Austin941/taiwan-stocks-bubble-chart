export default async function handler(req, res) {
  // Allow CORS & Edge Cache for 5 minutes (300 seconds)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  const { symbol = '2330', days = '30' } = req.query;

  try {
    // Standardize symbol (e.g., 2330.TW -> 2330)
    const cleanSymbol = symbol.replace('.TW', '').replace('.TWO', '').replace('TWSE:', '').replace('OTC:', '').trim();

    // Calculate start date based on requested days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (parseInt(days) || 30));

    const startDateStr = startDate.toISOString().split('T')[0];

    // Fetch from FinMind API for detailed historical chip data
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInstitutionalInvestorsBuySell&data_id=${encodeURIComponent(cleanSymbol)}&start_date=${startDateStr}`;
    
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

    // Group raw data by date
    // FinMind returns entries per investor type per day
    const dateMap = {};

    rawData.forEach(item => {
      const { date, name, buy, sell } = item;
      if (!dateMap[date]) {
        dateMap[date] = {
          date,
          symbol: cleanSymbol,
          foreignNet: 0,        // 外資買賣超張數
          investTrustNet: 0,    // 投信買賣超張數
          dealerNet: 0,         // 自營商買賣超張數
          totalNet: 0           // 三大法人合計
        };
      }

      const net = (buy || 0) - (sell || 0);

      if (name.includes('Foreign')) {
        dateMap[date].foreignNet += net;
      } else if (name.includes('Investment_Trust')) {
        dateMap[date].investTrustNet += net;
      } else if (name.includes('Dealer')) {
        dateMap[date].dealerNet += net;
      }
      
      dateMap[date].totalNet += net;
    });

    const formattedData = Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Summary calculation for recent 5 days
    const recent5 = formattedData.slice(-5);
    const summary5d = {
      foreignTotal5d: recent5.reduce((acc, curr) => acc + curr.foreignNet, 0),
      investTrustTotal5d: recent5.reduce((acc, curr) => acc + curr.investTrustNet, 0),
      dealerTotal5d: recent5.reduce((acc, curr) => acc + curr.dealerNet, 0),
      totalNet5d: recent5.reduce((acc, curr) => acc + curr.totalNet, 0)
    };

    res.status(200).json({
      success: true,
      symbol: cleanSymbol,
      count: formattedData.length,
      summary5d,
      data: formattedData
    });

  } catch (error) {
    console.error('Chip API Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch institutional investor chip data',
      details: error.message
    });
  }
}
