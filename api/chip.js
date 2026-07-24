// api/chip.js — 三大法人籌碼 (重構版)
// 改用 finmindFetcher：共用快取，不再重複打 FinMind
import { fetchFinmind, startDateFromDays, cleanTWSymbol } from './_lib/finmindFetcher.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  const { symbol = '2330', days = '30' } = req.query;

  try {
    const sym       = cleanTWSymbol(symbol);
    const startDate = startDateFromDays(days);

    // 使用共享抓取器 — major_holders.js 同時請求不會重複打 FinMind
    const rawData = await fetchFinmind(
      'TaiwanStockInstitutionalInvestorsBuySell', sym, startDate
    );

    // Group by date
    const dateMap = {};
    rawData.forEach(({ date, name, buy, sell }) => {
      if (!dateMap[date]) dateMap[date] = {
        date, symbol: sym,
        foreign_net: 0, trust_net: 0, dealer_net: 0, total_net: 0,
      };
      const net = (buy || 0) - (sell || 0);
      if      (name.includes('Foreign'))           dateMap[date].foreign_net     += net;
      else if (name.includes('Investment_Trust'))  dateMap[date].trust_net       += net;
      else if (name.includes('Dealer'))            dateMap[date].dealer_net      += net;
      dateMap[date].total_net += net;
    });

    const data = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
    const recent5 = data.slice(-5);

    res.status(200).json({
      success: true, symbol: sym, count: data.length,
      summary5d: {
        foreignTotal5d:     recent5.reduce((s, d) => s + d.foreign_net, 0),
        investTrustTotal5d: recent5.reduce((s, d) => s + d.trust_net,   0),
        dealerTotal5d:      recent5.reduce((s, d) => s + d.dealer_net,  0),
        totalNet5d:         recent5.reduce((s, d) => s + d.total_net,   0),
      },
      data,
    });
  } catch (err) {
    console.error('[chip] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
