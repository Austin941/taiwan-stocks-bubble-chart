export default async function handler(req, res) {
  // Allow CORS & Edge Cache for 10 minutes (600 seconds)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200');

  try {
    // Fetch TWSE RWD Institutional T86 for market overview
    const tseRes = await fetch('https://www.twse.com.tw/rwd/zh/fund/T86?response=json', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    let marketOverview = {
      date: new Date().toISOString().split('T')[0],
      foreignTotalNet: 0,
      stateBankNetEst: 0,
      defenseIndex: 0,
      status: 'NORMAL'
    };

    let topDefenseTargets = [];

    if (tseRes.ok) {
      const tseData = await tseRes.json();
      const rawRows = tseData.data || [];
      const date = tseData.date || marketOverview.date;

      let foreignSum = 0;
      const targetStocks = [];

      rawRows.forEach(row => {
        const code = row[0]?.trim();
        const name = row[1]?.trim();
        const foreignNet = parseInt((row[4] || '0').replace(/,/g, ''), 10) || 0;
        const totalNet = parseInt((row[18] || '0').replace(/,/g, ''), 10) || 0;

        foreignSum += foreignNet;

        // Key weighted stocks (護盤重點權值股: 2330 台積電, 2454 聯發科, 2317 鴻海, 金控族群)
        if (['2330', '2454', '2317', '2881', '2882', '2886', '2303'].includes(code)) {
          // Typically when foreign investors sell heavily, state banks buy in reverse
          const estimatedBankBuyShares = foreignNet < 0 ? Math.abs(foreignNet) * 0.45 : -foreignNet * 0.2;

          targetStocks.push({
            code,
            name,
            foreignNetShares: foreignNet,
            totalNetShares: totalNet,
            estimatedStateBankNetShares: Math.round(estimatedBankBuyShares)
          });
        }
      });

      // State bank net estimation model based on inverse market foreign flows
      // (When Foreign sells > 10,000 shares, State Banks counter-buy aggressively)
      const stateBankNetEst = foreignSum < 0 ? Math.abs(foreignSum) * 0.35 : -foreignSum * 0.25;

      // Defense Index calculation (0 - 100)
      // Higher score indicates stronger National Fund / State Bank intervention signal
      let defenseIndex = 50;
      if (foreignSum < -200000000) defenseIndex += 35; // Heavy foreign sellout
      else if (foreignSum < -100000000) defenseIndex += 20;
      else if (foreignSum > 100000000) defenseIndex -= 15;

      defenseIndex = Math.min(100, Math.max(0, defenseIndex));

      let status = 'NORMAL';
      if (defenseIndex >= 80) status = 'NATIONAL_FUND_DEFENSE_HIGH'; // 國安強烈護盤訊號
      else if (defenseIndex >= 65) status = 'STATE_BANK_SUPPORTING'; // 公股護盤中
      else if (defenseIndex <= 30) status = 'TAKING_PROFIT';         // 高檔調節

      marketOverview = {
        date,
        foreignTotalNetShares: foreignSum,
        estimatedStateBankNetShares: Math.round(stateBankNetEst),
        defenseIndex,
        status,
        statusText: status === 'NATIONAL_FUND_DEFENSE_HIGH' ? '🚨 國安基金高強度護盤觸發' :
                    status === 'STATE_BANK_SUPPORTING' ? '🛡️ 八大公股行庫逆向護盤中' :
                    status === 'TAKING_PROFIT' ? '☀️ 市場走強，公股高檔順勢調節' : '⚖️ 市場籌碼相對平穩'
      };

      topDefenseTargets = targetStocks;
    }

    res.status(200).json({
      success: true,
      overview: marketOverview,
      topDefenseTargets
    });

  } catch (error) {
    console.error('Banks API Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch state-owned bank & national fund defense data',
      details: error.message
    });
  }
}
