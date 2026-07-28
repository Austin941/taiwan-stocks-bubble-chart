// ============================================================
// api/_lib/cacheControl.js — 智慧時間型快取控制 (Time-based Smart Cache-Control)
// 根據台北時間 (Asia/Taipei, UTC+8) 動態計算距離下一次資料公布時間還有幾秒
// 作為 Vercel Edge CDN 的 s-maxage，將 Serverless 流量消耗降至極致
// ============================================================

/**
 * 計算距離台北時間下一個指定時刻 (targetHour:targetMinute) 的秒數
 * @param {number} targetHour - 0-23
 * @param {number} targetMinute - 0-59
 * @param {number} minCacheSeconds - 最小快取秒數 (預設 300 秒)
 * @returns {number} s-maxage 秒數
 */
export function getSecondsUntilTaipeiTime(targetHour, targetMinute, minCacheSeconds = 300) {
  const now = new Date();
  // 轉為台北時間 (UTC+8)
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const taipeiMs = utcMs + (8 * 3600000);
  const taipeiDate = new Date(taipeiMs);

  const targetDate = new Date(taipeiMs);
  targetDate.setHours(targetHour, targetMinute, 0, 0);

  // 若今日已過目標時刻，設定為明日目標時刻
  if (taipeiDate >= targetDate) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  const diffSeconds = Math.floor((targetDate.getTime() - taipeiDate.getTime()) / 1000);
  return Math.max(diffSeconds, minCacheSeconds);
}

/**
 * 快速生成目標時間點的 Cache-Control 標頭字串
 * @param {number} targetHour - 0-23
 * @param {number} targetMinute - 0-59
 * @param {number} minCacheSeconds - 最小快取秒數
 * @returns {string} Cache-Control header value
 */
export function buildTimeBasedCacheHeader(targetHour, targetMinute, minCacheSeconds = 300) {
  const sMaxAge = getSecondsUntilTaipeiTime(targetHour, targetMinute, minCacheSeconds);
  const swr = Math.min(sMaxAge, 600); // stale-while-revalidate 最長 10 分鐘
  return `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;
}
