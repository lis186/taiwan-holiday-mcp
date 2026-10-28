[English](README.en.md) | [繁體中文](README.md)

# Taiwan Holiday MCP Server

[![Node.js Version](https://img.shields.io/node/v/taiwan-holiday-mcp.svg)](https://nodejs.org/)
[![npm version](https://badge.fury.io/js/taiwan-holiday-mcp.svg)](https://badge.fury.io/js/taiwan-holiday-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=taiwan-holiday&config=eyJjb21tYW5kIjoibnB4IHRhaXdhbi1ob2xpZGF5LW1jcCJ9)

An MCP (Model Context Protocol) server for looking up Taiwan holidays. It returns official public holidays and make-up workdays (補班日).

## ✨ Features

- 🇹🇼 **Accurate Taiwan holiday data**: government-published dates from [TaiwanCalendar](https://github.com/ruyut/TaiwanCalendar)
- 🚀 **Live queries**: a single day, a date range, the next holidays, workdays (including make-up workdays), and statistics
- 🌀 **Typhoon day-off status**: today and tomorrow from the DGPA live page, other dates from the archive (since 2001-07-30)
- 📅 **Several date formats**: `YYYY-MM-DD` and `YYYYMMDD`
- 🔄 **Smart cache**: responses are cached automatically so repeat lookups stay fast
- 🛠️ **MCP compliant**: follows the Model Context Protocol
- 🎯 **Built for AI clients**: Claude Desktop, Cursor, and similar tools
- 📊 **Statistics**: holiday counts and breakdowns
- 🌐 **Cross-platform**: Windows, macOS, and Linux

## 🚀 Quick start

### Use it with npx (recommended)

No install required:

```bash
npx taiwan-holiday-mcp
```

### Install globally

```bash
npm install -g taiwan-holiday-mcp
taiwan-holiday-mcp
```

### Install for development

```bash
git clone https://github.com/lis186/taiwan-holiday-mcp.git
cd taiwan-holiday-mcp
npm install
npm run build
npm start
```



## 🔧 Client setup

### Claude Desktop

Add this to the Claude Desktop config:

```json
{
  "mcpServers": {
    "taiwan-holiday": {
      "command": "npx",
      "args": ["taiwan-holiday-mcp"]
    }
  }
}
```

**Config file location:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Cursor

Click the button to install.

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=taiwan-holiday&config=eyJjb21tYW5kIjoibnB4IHRhaXdhbi1ob2xpZGF5LW1jcCJ9)

### Windsurf

Add this to the project's `.cursorrules` or config file:

```json
{
  "mcp": {
    "servers": {
      "taiwan-holiday": {
        "command": "npx",
        "args": ["taiwan-holiday-mcp"]
      }
    }
  }
}
```

## 📖 Examples

After setup, ask in natural language. English prompts work; the holiday names in the data stay in Chinese.

### Basic questions

**You can ask:**
> "Is October 10, 2025 a holiday?" (2025年10月10日是假期嗎？)
>
> "Which holidays are there in January 2025?" (幫我查一下2025年1月有哪些假期)
>
> "How many holidays are there in 2025?" (2025年總共有多少個假期？)

**The client calls the matching tool and can answer along these lines:**
- ✅ October 10, 2025 is National Day (國慶日), a holiday
- 📅 January 2025 has 14 holidays, including the Lunar New Year break (春節連假)
- 📊 2025 has 115 holidays in total

### Practical conversations

#### 🏖️ Planning time off

**You:** "I want to travel in the first quarter of 2025. Which long weekends can I use?" (我想規劃2025年第一季的旅遊，幫我找出有哪些連假可以安排？)

**The assistant** looks up January–March, finds consecutive holidays, and can tell you:
- Lunar New Year (春節連假): January 27–31 (5 days)
- 228 Memorial Day weekend (228連假): February 28–March 2 (3 days)
- Other weekend arrangements

#### 💼 Work schedule

**You:** "Do I have to work next Monday, October 6, 2025?" (下週一（2025年10月6日）需要上班嗎？)

**The assistant** checks that date and says whether it is a workday. If it is a holiday, it includes the reason.

#### 🌀 Typhoon day off

**You:** "A typhoon is coming. Do I have to work in Taipei tomorrow?" (颱風要來了，明天臺北市要上班嗎？)

**The assistant** looks up tomorrow's work and school closure announcements for Taipei:
- If work and school are suspended, it gives the period (all day, afternoon, or from a set time).
- If only some districts or school levels are affected, it lists them.
- If nothing has been announced yet, it says it cannot confirm. It does not treat that as a normal workday, and it points you to the city government's announcement.

#### 📈 Holiday stats

**You:** "How many holidays are in October 2025, and are any of them major festivals?" (2025年10月份有幾個假期？有什麼重要節日嗎？)

**The assistant** returns that month's counts, including public holidays and notable festivals.

### Going further

#### 🎯 Picking a month to travel

**You:** "Which month in 2025 is the best time to take leave and travel?" (幫我分析2025年哪個月份最適合請假旅遊？)

**The assistant** compares how holidays fall in each month, including the length and frequency of long weekends, and suggests a month.

#### 📅 A year of long breaks

**You:** "List every long holiday in 2025." (我想看2025年所有的長假期，幫我整理一個清單)

**The assistant** finds breaks of three days or more and lists them in date order.

## 🛠️ API

### MCP tools

#### `check_holiday`

Check whether a date is a Taiwan holiday.

**Parameters:**
- `date` (string): `YYYY-MM-DD` or `YYYYMMDD`

**Returns:**
```json
{
  "success": true,
  "data": {
    "date": "2025-10-10",
    "isHoliday": true,
    "description": "國慶日",
    "week": "五",
    "normalizedDate": "20251010"
  }
}
```

`description` and `week` come from the upstream calendar and stay in Chinese (`國慶日` is National Day; `五` is Friday).

#### `get_holidays_in_range`

List every Taiwan holiday in a date range.

**Parameters:**
- `start_date` (string): start date
- `end_date` (string): end date

**Returns:**
```json
{
  "success": true,
  "data": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-31",
    "holidays": [...],
    "totalCount": 14,
    "summary": "在 2025-01-01 到 2025-01-31 期間共有 14 個假期"
  }
}
```

The `summary` string is Chinese: "14 holidays from 2025-01-01 through 2025-01-31."

#### `get_holiday_stats`

Holiday statistics for a year, or for one month of a year.

**Parameters:**
- `year` (number): year, from 2017 (the years you can actually query depend on the upstream data)
- `month` (number, optional): month (1–12)

**Returns:**
```json
{
  "success": true,
  "data": {
    "year": 2025,
    "statistics": {
      "year": 2025,
      "totalHolidays": 115,
      "nationalHolidays": 113,
      "compensatoryDays": 2,
      "holidayTypes": {...}
    },
    "summary": "2025 年共有 115 個假期"
  }
}
```

#### `get_next_holidays`

The next N Taiwan holidays after a start date. This matches `holiday next` in [`taiwan-holiday-cli`](https://github.com/lis186/taiwan-holiday-cli): the start date itself is excluded even if it is a holiday, and the search window is 365 days after the start date, capped at the last year the upstream data has published.

**Parameters:**
- `date` (string, optional): start date, `YYYY-MM-DD` or `YYYYMMDD`. Defaults to today in Asia/Taipei
- `count` (integer, optional): how many to return. Default `1`, maximum `366`
- `skip_weekends` (boolean, optional): skip ordinary weekends (Saturday or Sunday whose description is empty or `週末`). Named holidays that fall on a weekend are kept. Default `false`

**Returns:**
```json
{
  "success": true,
  "data": {
    "found": true,
    "count": 2,
    "fromDate": "2026-01-01",
    "searchedThrough": "2026-12-31",
    "truncatedByData": false,
    "holidays": [
      { "date": "2026-01-03", "week": "六", "description": "週末" },
      { "date": "2026-01-04", "week": "日", "description": "週末" }
    ]
  },
  "tool": "get_next_holidays"
}
```

`searchedThrough` is the last day this search actually covered. When `truncatedByData` is `true`, the 365-day window was cut off by the last published year. Fewer results than `count` does not mean there are no holidays after that.

When the window really contains no holidays, `found` is `false`, `holidays` is `[]`, and `message` is `"查無假期"` ("no holidays found"). If the start date is later than the published data, the message is `上游最新資料只到 N 年` ("upstream data only goes through year N"). An empty description on an ordinary weekend is shown as `週末`. Make-up workdays are not holidays and do not appear in this list.

#### `get_workdays`

Count workdays for a whole month, or for an inclusive date range. Pass one mode or the other, not both. This matches `holiday workdays` and `holiday between` in the CLI:

- Weekends and days with `isHoliday: true` count toward `holidays`, not `workdays`
- `workdays = totalDays - holidays`
- A make-up workday (description contains `補行上班`, "make-up workday") is not a holiday, so it counts as a workday. `makeupWorkdays` is how many of those days there are, and `makeupWorkdayDates` lists them

**Whole-month parameters:**
- `year` (integer): year
- `month` (integer): month, 1–12

**Range parameters:**
- `start_date` (string): first day, `YYYY-MM-DD` or `YYYYMMDD`
- `end_date` (string): last day, same format

**Whole-month result:**
```json
{
  "success": true,
  "data": {
    "year": 2024,
    "month": 1,
    "totalDays": 31,
    "workdays": 22,
    "holidays": 9,
    "makeupWorkdays": 1,
    "makeupWorkdayDates": [
      { "date": "2024-01-06", "week": "六", "description": "補行上班" }
    ]
  },
  "tool": "get_workdays"
}
```

**Range result:**
```json
{
  "success": true,
  "data": {
    "startDate": "2024-01-06",
    "endDate": "2024-01-07",
    "totalDays": 2,
    "workdays": 1,
    "holidays": 1,
    "makeupWorkdays": 1,
    "makeupWorkdayDates": [
      { "date": "2024-01-06", "week": "六", "description": "補行上班" }
    ]
  },
  "tool": "get_workdays"
}
```

For a whole month, `totalDays` is the number of calendar days (29 in a leap-year February). The upstream record count for that range must equal the calendar length. One day short or one day extra is an error — for example `上游 2024 年 2 月 資料不完整（預期 29 筆，實得 2 筆）` ("upstream February 2024 data is incomplete: expected 29 records, got 2") — and missing days are not treated as workdays.

#### `check_typhoon_closure`

Look up typhoon day-off status (天然災害停止上班上課: work and school suspended because of a natural disaster). The rules and the live-page parser come from [`taiwan-holiday-cli`](https://github.com/lis186/taiwan-holiday-cli); see the 「颱風假查詢」 section of its README for field semantics.

**Sources:** today and tomorrow come from the DGPA live page, [天然災害停止上班及上課情形](https://www.dgpa.gov.tw/typh/daily/nds.html). Other dates come from the [TaiwanTyphoonDays](https://github.com/lis186/TaiwanTyphoonDays) archive (since 2001-07-30).

**Parameters:**
- `date` (string, optional): `today`, `tomorrow`, `YYYY-MM-DD`, or `YYYYMMDD`. Defaults to today in Taiwan time
- `city` (string, optional): city or county name; 台 and 臺 are treated the same. Omit it for all of Taiwan

**Returns:** `summary` is a one-line verdict and `data` is the full `TyphoonQueryResult`.

```json
{
  "success": true,
  "summary": "2024-10-31 臺北市：停止上班（全天）、停止上課（全天）〔已定案〕",
  "data": {
    "date": "20241031",
    "city": "臺北市",
    "work": { "status": "stopped", "period": "allDay", "from": "" },
    "school": { "status": "stopped", "period": "allDay", "from": "" },
    "basis": "own",
    "reason": null,
    "source": {...},
    "cities": [...],
    "notes": [...]
  }
}
```

**How to read it:**
- `status: "unknown"` means the status cannot be determined. **Never treat it as a normal day.**
- `conditional` means only some districts, school levels, or time periods are affected; check `cities[].rows`.
- A non-null `reason` means the result can still change (`live` is the live page, which can update during the day).
- Dates from yesterday back to 21 days ago are often `unknown` / `pending`: the live page only covers today and tomorrow, and the archive usually lags by a few days.
- Follow the official announcement from each city or county government.

### MCP resources

The server exposes:

- `taiwan-holidays://years` — supported years
- `taiwan-holidays://holidays/{year}` — the full holiday calendar for a year
- `taiwan-holidays://stats/{year}` — statistics for a year

## 🔍 Troubleshooting

### Common problems

#### 1. Cannot connect to the server

**Symptom:** Claude Desktop says it cannot connect to the MCP server ("無法連接到 MCP 伺服器").

**What to try:**
```bash
# Node.js 22 or newer is required
node --version

# Reinstall
npm uninstall -g taiwan-holiday-mcp
npm install -g taiwan-holiday-mcp

# Check that the binary runs
taiwan-holiday-mcp --version
```

#### 2. Invalid date format

**Symptom:** an "invalid date format" error (`無效的日期格式`).

**What to try:**
- Use `YYYY-MM-DD` or `YYYYMMDD`
- Check that the date exists (2025-02-30 is not a real date)

#### 3. Network problems

**Symptom:** holiday data cannot be fetched.

**What to try:**
```bash
# Check that the upstream calendar is reachable
curl -I https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/2025.json

# Clear the local cache if it looks stale
rm -rf ~/.taiwan-holiday-mcp-cache
```

### Debug logging

```bash
taiwan-holiday-mcp --debug
```

### Slow queries

If lookups are slow:

1. Check the network connection
2. Confirm the cache is working
3. Consider a local data source

## 🧪 Development and tests

See [DEVELOPMENT.md](DEVELOPMENT.md) for the longer development guide.

### Local development

```bash
# Clone
git clone https://github.com/lis186/taiwan-holiday-mcp.git
cd taiwan-holiday-mcp

# Install
npm install

# Run tests
npm test

# Build
npm run build

# Start in development mode
npm run dev
```

### Test coverage

```bash
npm run test:coverage
```

Current coverage: **93.68%** statements (522 tests passed, 8 skipped because of the environment)

**Core modules** (statements):
- SmartCache: 98.97% ✅
- HealthMonitor: 98.78% ✅
- DateParser: 98.97% ✅
- CircuitBreaker: 100% ✅
- GracefulShutdown: 89.42% ✅

Mutation testing is opt-in and is not part of CI. Run `npm run test:mutation` (Stryker). Current score: **98.51%**.

## 📊 Performance

- **First API call**: < 2 seconds
- **Cached API call**: < 100ms
- **Concurrency**: 10+ concurrent requests
- **Memory**: < 50MB
- **Test stability**: 522 tests passed (8 skipped because of the environment)
- **Code coverage**: 93.68% statements (well above the common 80% bar)

## 🤝 Contributing

Contributions are welcome:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push the branch (`git push origin feature/amazing-feature`)
5. Open a pull request

## ⚠️ Disclaimer

### Source and accuracy

Taiwan holiday data comes from the open-source project [TaiwanCalendar](https://github.com/ruyut/TaiwanCalendar), which is based on official holiday announcements from the government of the Republic of China (Taiwan).

Typhoon day-off data comes from the Directorate-General of Personnel Administration (DGPA) [live page](https://www.dgpa.gov.tw/typh/daily/nds.html) for today and tomorrow, and from the [TaiwanTyphoonDays](https://github.com/lis186/TaiwanTyphoonDays) archive for other dates. The live page's format is not an official interface and can change without notice; the archive usually lags the event by a few days. **For work and school closures, follow each city or county government's official announcement.** When this server reports that a status cannot be determined, that does not mean work and school go ahead as usual.

**Please note:**

1. **Accuracy.** We try to keep the data correct, but this project does not guarantee that every holiday is accurate or up to date.
2. **Official source.** For the authoritative calendar, use announcements from the relevant government agencies.
3. **Updates.** Holidays can change when policy changes. This project follows those updates as it can, and there can be a delay.
4. **Your responsibility.** Verify dates that matter, especially for business or legal use.

### Availability

- The service depends on an external data source and can be unavailable when the network or that source fails
- We do not guarantee 100% uptime or a particular response time
- Use proper error handling and a fallback in any critical application

### Limitation of liability

To the fullest extent permitted by law, the authors and contributors are not liable for any direct, indirect, incidental, special, or consequential damages arising from use of this software.

## 🔗 Related projects

- [`taiwan-holiday-cli`](https://github.com/lis186/taiwan-holiday-cli) — command-line tool over the same data, for terminals and scripts
- [`taiwan-holiday-skills`](https://github.com/lis186/taiwan-holiday-skills) — a packaged Claude Agent Skill (it calls the CLI)

The three projects share a MAJOR version. They are currently on the 2.x line.

## 📄 License

MIT. See [LICENSE](LICENSE).

## 🙏 Acknowledgements

- [TaiwanCalendar](https://github.com/ruyut/TaiwanCalendar) — Taiwan holiday data
- [Model Context Protocol](https://modelcontextprotocol.io/) — the protocol these tools speak

## 📞 Support

- **GitHub Issues**: [report a problem](https://github.com/lis186/taiwan-holiday-mcp/issues)
- **Docs**: [full documentation](https://github.com/lis186/taiwan-holiday-mcp/docs)

---

**Years covered**: from 2017, up to whatever the upstream data has published (a new year is picked up when it is released)  
**MCP SDK**: @modelcontextprotocol/sdk ^1.13.0  
**Node.js**: ≥ 22.0.0  
**Status**: production-ready ✅
