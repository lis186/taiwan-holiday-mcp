/**
 * 上游資料的驗證規則。
 *
 * 從 upstream-canary.mjs 抽出成獨立模組，理由有二：
 * 1. CONTRIBUTING.md 要求所有新程式碼都有測試，而哨兵腳本原本是頂層 await 的
 *    一次性腳本，無法被測試 import。
 * 2. 驗證規則是這支哨兵唯一有邏輯的部分，最需要被畸形資料測試釘住。
 */

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 台北時區的當前年份。CI runner 通常是 UTC，用主機時區會讓「歷史年份」判定錯位。 */
export function currentYearInTaipei(now = Date.now()) {
  return new Date(now + 8 * 60 * 60 * 1000).getUTCFullYear();
}

/** 一年應有的天數 */
export function daysInYear(year) {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return isLeap ? 366 : 365;
}

/**
 * 驗證某年度的上游資料，回傳問題清單（空陣列 = 通過）。
 *
 * 刻意回傳而非拋出：一次跑完所有檢查才能一次看到全部問題，
 * 而不是修一個才發現下一個。
 */
export function validateYearData(year, data) {
  const problems = [];
  const fail = (msg) => problems.push(`${year}: ${msg}`);

  if (!Array.isArray(data)) {
    fail('回應不是陣列');
    return problems;
  }
  // 空陣列必須早退：後面會取 data[0].date
  if (data.length === 0) {
    fail('回應是空陣列');
    return problems;
  }

  const expected = daysInYear(year);
  if (data.length !== expected) fail(`應有 ${expected} 筆，實得 ${data.length}`);

  for (const [i, d] of data.entries()) {
    // `'date' in null` 會拋 TypeError，哨兵就變成噴 stack trace 而非診斷
    if (d === null || typeof d !== 'object' || Array.isArray(d)) {
      fail(`第 ${i} 筆不是物件（實為 ${d === null ? 'null' : typeof d}）`);
      return problems;
    }
    for (const field of ['date', 'week', 'isHoliday', 'description']) {
      if (!(field in d)) {
        fail(`第 ${i} 筆缺少欄位 ${field}`);
        return problems;
      }
    }
    if (typeof d.isHoliday !== 'boolean') {
      fail(`第 ${i} 筆 isHoliday 不是布林`);
      return problems;
    }
    for (const field of ['date', 'week', 'description']) {
      if (typeof d[field] !== 'string') {
        fail(`第 ${i} 筆 ${field} 不是字串（實為 ${typeof d[field]}）`);
        return problems;
      }
    }
    if (!/^\d{8}$/.test(d.date)) {
      fail(`第 ${i} 筆 date 格式異常 (${d.date})`);
      return problems;
    }
  }

  const dates = data.map((d) => d.date);
  if (new Set(dates).size !== dates.length) fail('有重複日期');

  // 逐日連續 + 星期正確。
  // 只驗「week 在合法值域內」擋不住整體錯位（例如全部往後移一天）——
  // 必須依日期算出應有的星期再比對。
  const cursor = new Date(Date.UTC(year, 0, 1));
  for (const [i, d] of data.entries()) {
    const wantDate =
      `${cursor.getUTCFullYear()}` +
      String(cursor.getUTCMonth() + 1).padStart(2, '0') +
      String(cursor.getUTCDate()).padStart(2, '0');
    if (d.date !== wantDate) {
      fail(`第 ${i} 筆應為 ${wantDate}，實為 ${d.date}`);
      return problems;
    }
    const wantWeek = WEEKDAYS[cursor.getUTCDay()];
    if (d.week !== wantWeek) {
      fail(`第 ${i} 筆（${d.date}）星期應為 ${wantWeek}，實為 ${d.week}`);
      return problems;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // 合理性：週末約 104 天，加上國定假日與補假
  const holidayCount = data.filter((d) => d.isHoliday).length;
  if (holidayCount < 100 || holidayCount > 140) {
    fail(`放假天數 ${holidayCount} 落在合理區間之外 (100-140)`);
  }

  return problems;
}
