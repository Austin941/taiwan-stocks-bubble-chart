export default async function handler(req, res) {
  // Set CORS & Edge Cache headers (5 min cache)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  const { symbol = '2330', days = '30' } = req.query;

  try {
    const cleanSymbol = symbol.replace('.TW', '').replace('.TWO', '').replace('TWSE:', '').replace('OTC:', '').trim();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (parseInt(days) || 30));
    const startDateStr = startDate.toISOString().split('T')[0];

    // Fetch Institutional Investors (三大法人) and Margin (融資融券) and Shareholding Base
    const [chipRes, marginRes, shareholdingRes] = await Promise.all([
      fetch(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInstitutionalInvestorsBuySell&data_id=${encodeURIComponent(cleanSymbol)}&start_date=${startDateStr}`),
      fetch(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockMarginPurchaseShortSale&data_id=${encodeURIComponent(cleanSymbol)}&start_date=${startDateStr}`),
      fetch(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockShareholding&data_id=${encodeURIComponent(cleanSymbol)}&start_date=${startDateStr}`)
    ]);

    const chipResult = chipRes.ok ? await chipRes.json() : { data: [] };
    const marginResult = marginRes.ok ? await marginRes.json() : { data: [] };
    const shareholdingResult = shareholdingRes.ok ? await shareholdingRes.json() : { data: [] };

    const chipData = chipResult.data || [];
    const marginData = marginResult.data || [];
    const shareholdingData = shareholdingResult.data || [];

    // Base shares issued
    const baseItem = shareholdingData[shareholdingData.length - 1] || {};
    const totalIssuedShares = baseItem.NumberOfSharesIssued || 25932370067; // Fallback TSMC issued shares
    const baseForeignRatio = baseItem.ForeignInvestmentSharesRatio || 70.37; // Base foreign ratio %

    // Group chip by date
    const dateChipMap = {};
    chipData.forEach(item => {
      const { date, name, buy, sell } = item;
      if (!dateChipMap[date]) {
        dateChipMap[date] = { foreignNet: 0, investTrustNet: 0, dealerNet: 0, totalNet: 0 };
      }
      const net = (buy || 0) - (sell || 0);
      if (name.includes('Foreign')) dateChipMap[date].foreignNet += net;
      else if (name.includes('Investment_Trust')) dateChipMap[date].investTrustNet += net;
      else if (name.includes('Dealer')) dateChipMap[date].dealerNet += net;
      dateChipMap[date].totalNet += net;
    });

    // Group margin by date
    const dateMarginMap = {};
    marginData.forEach(item => {
      const { date, MarginPurchaseTodayBalance = 0, MarginPurchaseYesterdayBalance = 0 } = item;
      dateMarginMap[date] = {
        marginBalance: MarginPurchaseTodayBalance,
        marginChange: MarginPurchaseTodayBalance - MarginPurchaseYesterdayBalance
      };
    });

    // Get all unique sorted dates
    const allDates = Array.from(new Set([...Object.keys(dateChipMap), ...Object.keys(dateMarginMap)])).sort();

    // Baseline 1000+ shares estimation (Base anchor ~ +6.5% above Foreign ratio for major holders)
    let currentEstMajorRatio = parseFloat((baseForeignRatio + 6.5).toFixed(2));

    const dailyEstimations = [];

    allDates.forEach(date => {
      const chip = dateChipMap[date] || { foreignNet: 0, investTrustNet: 0, dealerNet: 0, totalNet: 0 };
      const margin = dateMarginMap[date] || { marginBalance: 0, marginChange: 0 };

      // Algorithm: Daily 1000+ Shareholder Net Change (股)
      // Major Net Change = Institutional Net (外資+投信+自營) - Retail Margin Shift (融資增減股數 * 1000 * 0.85)
      const retailShiftShares = Math.round(margin.marginChange * 1000 * 0.85);
      const estDailyMajorNetShares = (chip.foreignNet + chip.investTrustNet + chip.dealerNet) - retailShiftShares;

      // Exact ratio % change of total issued shares
      const deltaRatioPercent = (estDailyMajorNetShares / totalIssuedShares) * 100;
      currentEstMajorRatio = parseFloat((currentEstMajorRatio + deltaRatioPercent).toFixed(3));

      // Signal Status Classification
      let signal = 'NEUTRAL';
      let signalText = '⚖️ 大戶持股籌碼平衡';

      if (estDailyMajorNetShares > 2000000 && margin.marginChange <= 0) {
        signal = 'MAJOR_ACCUMULATING';
        signalText = '🔥 大戶即時強勢鎖碼 (法人大買 + 融資沉澱)';
      } else if (estDailyMajorNetShares < -2000000 && margin.marginChange > 0) {
        signal = 'MAJOR_DISTRIBUTING';
        signalText = '⚠️ 大戶暗中高檔出貨 (法人大賣 + 散戶融資接刀)';
      } else if (estDailyMajorNetShares > 1000000) {
        signal = 'MAJOR_BUYING';
        signalText = '🟢 大戶持續加碼';
      } else if (estDailyMajorNetShares < -1000000) {
        signal = 'MAJOR_SELLING';
        signalText = '🔴 大戶減碼調節';
      }

      dailyEstimations.push({
        date,
        symbol: cleanSymbol,
        institutionalTotalNetShares: chip.totalNet,
        retailMarginChangeShares: margin.marginChange,
        estDailyMajorNetShares,
        dailyEstMajorHoldersRatioPercent: currentEstMajorRatio,
        signal,
        signalText
      });
    });

    const latest = dailyEstimations[dailyEstimations.length - 1] || {};

    res.status(200).json({
      success: true,
      symbol: cleanSymbol,
      algorithmNote: '推算模型：基於每日三大法人買賣超淨額與散戶融資洗牌扣除額，每日即時滾動推算千張大戶持股比率 (%)',
      latestEstSummary: {
        date: latest.date || null,
        estDailyMajorNetShares: latest.estDailyMajorNetShares || 0,
        dailyEstMajorHoldersRatioPercent: latest.dailyEstMajorHoldersRatioPercent || 0,
        signal: latest.signal || 'NEUTRAL',
        signalText: latest.signalText || '⚖️ 大戶持股籌碼平衡'
      },
      count: dailyEstimations.length,
      data: dailyEstimations
    });

  } catch (error) {
    console.error('Major Holders API Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to estimate daily 1000+ shareholder changes',
      details: error.message
    });
  }
}
