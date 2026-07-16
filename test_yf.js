import { YahooFinance } from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function test() {
  try {
    const symbols = ['2330.TW', '2317.TW', '2454.TW'];
    const results = await yahooFinance.quote(symbols);
    console.log(results.map(r => `${r.symbol}: ${r.regularMarketPrice} (${r.regularMarketChangePercent}%)`));
  } catch (err) {
    console.error(err);
  }
}

test();
