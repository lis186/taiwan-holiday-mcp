#!/usr/bin/env node
/**
 * 上游資料哨兵
 *
 * 年份支援範圍是 runtime 探測的，所以上游發布新年度不需要改任何程式碼。
 * 這支腳本要抓的是另一件事：上游的結構或內容悄悄變了。
 *
 * 例如 ruyut/TaiwanCalendar 改了欄位名、jsDelivr 的 404 行為變了、
 * 或某年度資料只有半年 —— 這些都會讓探測給出看似正常但錯誤的答案。
 * 靜默失效比噴錯難發現得多，所以用排程把它變成會響的鈴。
 *
 * 驗證規則抽到 upstream-validate.mjs，那裡有對應的測試。
 */

import { validateYearData, currentYearInTaipei } from './upstream-validate.mjs';

const BASE = 'https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data';
const MIN_YEAR = 2017;
const PROBE_LIMIT = currentYearInTaipei() + 5;

const problems = [];

async function fetchYear(year) {
  const res = await fetch(`${BASE}/${year}.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${year}: HTTP ${res.status}`);
  return res.json();
}

const available = [];
for (let year = MIN_YEAR; year <= PROBE_LIMIT; year++) {
  let data;
  try {
    data = await fetchYear(year);
  } catch (error) {
    problems.push(`${year}: 抓取失敗 — ${error.message}`);
    break;
  }
  if (data === null) {
    // 只允許在「今年之後」出現缺口；歷史年份缺漏代表上游出事
    if (year <= currentYearInTaipei()) problems.push(`${year}: 歷史年份資料消失`);
    break;
  }
  problems.push(...validateYearData(year, data));
  available.push(year);
}

if (available.length === 0) problems.push('完全抓不到任何年份資料');

// 先處理失敗：抓不到任何年份時印出 NEWEST_YEAR=undefined 只會誤導呼叫端
if (problems.length > 0) {
  if (available.length > 0) {
    console.log(
      `可用年份：${available[0]}-${available[available.length - 1]}（共 ${available.length} 年）`
    );
  }
  console.error('上游資料異常：');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const newest = available[available.length - 1];
console.log(`可用年份：${available[0]}-${newest}（共 ${available.length} 年）`);
console.log(`NEWEST_YEAR=${newest}`);
console.log('上游資料符合預期。');
