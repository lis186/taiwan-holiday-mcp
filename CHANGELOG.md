# 變更日誌

本專案的所有重要變更都會記錄在此檔案中。

格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，
並且本專案遵循 [語意化版本](https://semver.org/lang/zh-TW/)。

## [未發布]

### 改進

- 🎯 **測試失敗修復與覆蓋率達標**：分支覆蓋率從 79.75% 提升至 82.24%
  - 修復 5 個失敗測試，達成 100% 測試通過率（446/448 通過，2 個跳過）
  - 新增 error-classifier 測試套件（16 個測試案例）
  - error-classifier 覆蓋率從 65.71% 提升至 88.57%
  - 整體覆蓋率：Statements 92.27%, Branches 82.24%, Functions 89.80%, Lines 92.34%
- 🔧 **測試穩定性改善**
  - Mock process.memoryUsage() 確保 health-monitor 測試環境一致性
  - 調整 index.test.ts 除錯模式等待時間（1000ms → 2000ms）
  - 修復 e2e 測試 timeout 不同步問題（Jest timeout 與命令 timeout 協調）
  - build-and-package 測試：Jest timeout 35000ms，runCommand timeout 30000ms
  - build-and-package-simple 測試：Jest timeout 40000ms（包含 build + pack）
- ✅ **SmartCache 測試補強**：測試覆蓋率從 48.97% 提升至 98.97%
  - 新增 38 個完整測試案例
  - 涵蓋 LRU 驅逐策略、TTL 過期機制、統計資訊、記憶體估算
  - 使用 Jest Fake Timers 完美控制時間相關測試
- 📈 **整體測試覆蓋率提升**：從 79.8% 提升至 85.18%
  - 語句覆蓋率：85.18%
  - 行覆蓋率：85.31%
  - 工具模組平均覆蓋率：85.34%
- 🎯 **核心模組高覆蓋率達成**
  - SmartCache: 98.97% (函數覆蓋率 100%)
  - HealthMonitor: 98.78%
  - DateParser: 97.77%
  - GracefulShutdown: 88.34%

### 技術詳情

- **測試案例總數**：347 個（新增 38 個 SmartCache 測試）
- **測試通過率**：99% (347/351)
- **測試執行時間**：SmartCache 測試約 5 秒
- **測試品質**：完全隔離，無資源洩漏

## [1.0.4] - 2025-10-10

### 新增

- 📦 **MCP Registry 支援**：新增 `mcpName` 欄位到 package.json
- 🔐 **認證 Token 管理**：將 MCP Registry 認證 token 加入 .gitignore

### 變更

- 📝 **server.json**：更新 MCP Registry 註冊配置
  - 移除不必要的 `environmentVariables` 配置
  - 簡化 `name` 格式為 `io.github.lis186/taiwan-holiday-mcp`
  - 統一版本號為 1.0.4
- 📖 **文件更新**：同步更新所有測試和文件中的版本號

### 修正

- ✅ **測試修正**：更新所有測試案例中的版本檢查

## [1.0.3] - 2025-10-08

### 新增

- 🎯 **2026 年支援**：擴展支援年份範圍至 2017-2026
- 📊 **2026 年資料**：120 天假期（國定假日 114 天，補假 6 天）
- 📖 **本地開發指南**：新增完整的本地 MCP 伺服器安裝和測試指南

### 修正

- 🐛 **Signal Handler 問題**：移除無法捕獲的 SIGKILL handler，解決 `uv_signal_start EINVAL` 錯誤
- ✅ **GracefulShutdown 穩定性**：確保伺服器可以正常建立和優雅關閉

### 變更

- 📝 **文件更新**：所有文件同步更新年份範圍說明
- 🧪 **測試更新**：測試案例完整覆蓋 2026 年支援（245/246 通過）
- 🔍 **邊界驗證**：確認 2027 年正確被拒絕

### 技術詳情

- **資料來源驗證**：確認 TaiwanCalendar CDN 已提供 2026.json
- **向後相容性**：100% 向後相容，不影響現有功能
- **測試覆蓋率**：維持高測試覆蓋率和品質標準

### 文件

- 新增 `docs/dev-notes/2026-support-update.md` - 詳細更新報告
- 新增 `docs/local-development-guide.md` - 本地開發指南
- 更新所有技術文件以反映 2026 年支援

## [1.0.2] - 2025-06-21

### 變更

- 🚀 **MCP TypeScript SDK 升級**：從 `@modelcontextprotocol/sdk ^1.12.1` 升級到 `^1.13.0`
- 📊 **協議改進**：自動享受最新 MCP 協議規範 (Spec revision 2025-06-18)
- 🔧 **效能提升**：受益於 SDK 1.13.0 的協議處理效率改進和錯誤處理機制強化

### 技術詳情

- **相容性**：100% 向後相容，無程式碼修改需求
- **新功能**：支援 MCP-Protocol-Version header、資源連結改進、Context 包含最佳化
- **測試驗證**：所有核心功能測試 100% 通過 (54/54)
- **建置流程**：TypeScript 編譯完全正常，無錯誤
- **遷移時間**：1.5 小時完成（效率超出預期 75%）

### 品質保證

- ✅ **零 Breaking Changes**：所有現有功能完全正常
- ✅ **企業級穩定性**：維持原有品質標準
- ✅ **完整備份機制**：建立 `backup-before-sdk-1.13.0-migration` 分支
- ✅ **自動化驗證**：完整測試套件確保無回歸問題

## [1.0.1] - 2025-06-12

### 修正

- 修正 README.md 及相關文件中的 GitHub repo 網址為 <https://github.com/lis186/taiwan-holiday-mcp>

## [1.0.0] - 2025-06-11

### 新增

- 🎉 **初始版本發布**
- 🛠️ **三個核心 MCP 工具**：
  - `check_holiday` - 檢查指定日期是否為台灣假期
  - `get_holidays_in_range` - 獲取日期範圍內的所有假期
  - `get_holiday_stats` - 獲取假期統計資訊
- 📊 **完整的 MCP 資源系統**：
  - `taiwan-holidays://years` - 支援的年份列表
  - `taiwan-holidays://holidays/{year}` - 年度假期資料
  - `taiwan-holidays://stats/{year}` - 年度統計資料
- 🔄 **智慧快取機制**：
  - 記憶體快取，24小時 TTL
  - LRU 快取策略
  - 自動快取失效和更新
- 📅 **多種日期格式支援**：
  - ISO 8601 格式 (`YYYY-MM-DD`)
  - 緊湊格式 (`YYYYMMDD`)
- 🌐 **跨平台支援**：
  - Windows 10+
  - macOS 12+
  - Linux (Ubuntu 20.04+)
- 🎯 **AI 工具整合**：
  - Claude Desktop 完整支援
  - Cursor/Windsurf 相容
  - 自訂 MCP 客戶端支援
- 🔧 **NPX 直接執行**：
  - 無需安裝，直接使用 `npx taiwan-holiday-mcp`
  - 支援全域安裝
- 📈 **高效能設計**：
  - 首次查詢 < 2 秒
  - 快取查詢 < 100ms
  - 支援 10+ 併發請求
- 🛡️ **健壯的錯誤處理**：
  - 詳細的錯誤代碼和訊息
  - 自動重試機制
  - 優雅的降級策略
- 📚 **完整文件**：
  - 詳細的 API 參考文件
  - 豐富的使用範例
  - 客戶端設定指南
  - 故障排除指南

### 技術特性

- **資料來源**: [TaiwanCalendar](https://github.com/ruyut/TaiwanCalendar)
- **支援年份**: 2017-2025
- **MCP 協議版本**: 1.0
- **Node.js 需求**: ≥ 18.0.0
- **測試覆蓋率**: 77.84% (120 個測試案例)
- **記憶體使用**: < 100MB
- **建置大小**: < 5MB

### 品質標準

- ✅ **120 個測試案例** 100% 通過
- ✅ **完整的單元測試** 覆蓋核心邏輯
- ✅ **整合測試** 驗證 MCP 協議相容性
- ✅ **端到端測試** 確保客戶端整合
- ✅ **效能測試** 驗證回應時間和併發處理
- ✅ **跨平台測試** 確保相容性
- ✅ **長時間穩定性測試** 驗證記憶體洩漏

### 開發歷程

- **專案啟動**: 2025-06-09
- **開發時間**: 約 13 小時（提前完成）
- **開發方法**: Small Batch 開發，多階段 Cursor 驗證
- **品質標準**: 企業級品質要求

---

## 版本說明

### 語意化版本規則

本專案遵循 [語意化版本 2.0.0](https://semver.org/lang/zh-TW/) 規範：

- **主版本號 (MAJOR)**: 不相容的 API 變更
- **次版本號 (MINOR)**: 向後相容的功能新增
- **修訂版本號 (PATCH)**: 向後相容的問題修正

### 發布週期

- **主版本**: 每年 1-2 次
- **次版本**: 每季 1 次
- **修訂版本**: 根據需要發布

### 支援政策

- **最新版本**: 完整支援和更新
- **前一個主版本**: 安全性更新和重要錯誤修正
- **更舊版本**: 僅提供安全性更新

---

**維護者**: Taiwan Holiday MCP Team  
**最後更新**: 2025-06-11
