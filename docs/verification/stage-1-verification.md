# 階段 1：專案基礎建設 + 早期 Cursor 整合 - 驗證標準

## 概述

本階段專注於建立專案基礎架構、核心型別定義，並進行早期 Cursor 整合驗證，確保 MCP 伺服器基本框架能正常運作。

## Task 1.1: 專案初始化 - 測試驗證 ✅ (已完成於 2025-06-10)

### 基本功能驗證

```bash
npm run build         # 確認 TypeScript 編譯成功
npm test             # 確認測試框架運作正常
npm run test:coverage # 確認覆蓋率報告生成
```

### 驗證標準

- [x] TypeScript 編譯無錯誤 ✅
- [x] Jest 測試框架正常啟動 ✅
- [x] 覆蓋率報告正確生成 ✅
- [x] 所有必要目錄結構建立完成 ✅
- [x] 依賴套件正確安裝 ✅

### 實際驗證結果

**✅ 成功項目：**
- TypeScript 編譯成功，無錯誤或警告
- Jest 測試框架正常運作，通過 2 個基本測試
- 覆蓋率報告正確生成
- 專案目錄結構完整：`src/`, `dist/`, `tests/`, `tests/unit/`, `tests/integration/`, `tests/fixtures/`
- 所有依賴正確安裝，包括：
  - 核心依賴：`@modelcontextprotocol/sdk ^1.12.1`
  - 開發依賴：`typescript ^5.8.3`, `jest ^29.7.0`, `ts-jest ^29.2.5` 等

**🔧 解決的問題：**
- Jest 配置最佳化：移除過時的 `globals` 設定，採用新的 `transform` 配置
- 移除無效的 `moduleNameMapping` 配置選項
- 建立基本的 `src/index.ts` 檔案以支援 TypeScript 編譯

## Task 1.2: 核心型別定義與測試設定 - 測試驗證

### 型別定義測試

```typescript
// tests/unit/types.test.ts
import { Holiday, HolidayStats } from '../../src/types';

describe('型別定義測試', () => {
  test('Holiday 介面應正確定義', () => {
    const testHoliday: Holiday = {
      date: "20240101",
      week: "一", 
      isHoliday: true,
      description: "開國紀念日"
    };
    expect(testHoliday.date).toBe("20240101");
    expect(testHoliday.isHoliday).toBe(true);
  });

  test('HolidayStats 介面應正確定義', () => {
    const stats: HolidayStats = {
      year: 2024,
      totalHolidays: 115,
      holidays: []
    };
    expect(stats.year).toBe(2024);
  });
});
```

### 驗證標準

- [ ] Holiday 介面正確定義並可編譯
- [ ] HolidayStats 介面正確定義並可編譯
- [ ] MCP 相關型別正確定義
- [ ] 測試環境配置正確
- [ ] 測試資料檔案建立完成

## Task 1.3: 早期 Cursor 整合驗證點

### 🎯 Cursor 整合測試

```bash
# 建置初始版本
npm run build

# 在 Cursor 中測試
# 1. 修改 .cursor/mcp.json:
{
  "mcp": {
    "servers": {
      "taiwan-holiday": {
        "command": "node",
        "args": ["./dist/index.js"],
        "cwd": "/path/to/your/project"
      }
    }
  }
}

# 2. 重啟 Cursor
# 3. 測試基本連接：在 Cursor 中詢問 "請列出可用的 MCP 工具"
# 4. 測試 ping 工具：在 Cursor 中詢問 "請執行 ping 工具"
```

### ✅ 早期驗證成功標準

- [ ] **T1.3.V1** Cursor 成功載入 MCP 伺服器
- [ ] **T1.3.V2** 可以列出 `ping` 工具
- [ ] **T1.3.V3** `ping` 工具可以正常執行並回傳 "pong"
- [ ] **T1.3.V4** 沒有 JSON-RPC 協議錯誤

## 階段 1 整體驗證清單

### 技術驗證

- [x] 專案結構完整建立 ✅
- [x] TypeScript 環境正確配置 ✅
- [x] 測試框架正常運作 ✅
- [ ] 核心型別定義完成
- [ ] 基礎 MCP 伺服器可運行

### Cursor 整合驗證

- [ ] MCP 伺服器成功載入
- [ ] 基本工具可以執行
- [ ] JSON-RPC 協議通訊正常
- [ ] 無協議錯誤或連接問題

### 品質標準

- [x] 程式碼編譯無警告 ✅
- [x] 測試覆蓋率 > 80% ✅ (目前 100%)
- [x] 無 TypeScript 型別錯誤 ✅
- [x] 依賴版本鎖定正確 ✅

## 故障排除指南

### 常見問題

1. **TypeScript 編譯錯誤**
   - 檢查 tsconfig.json 配置
   - 確認依賴版本相容性
   - 檢查型別定義正確性

2. **Cursor 無法載入 MCP 伺服器**
   - 確認 .cursor/mcp.json 路徑正確
   - 檢查 dist/index.js 是否存在
   - 重啟 Cursor 應用程式

3. **ping 工具無回應**
   - 檢查伺服器啟動日誌
   - 確認 JSON-RPC 協議實作
   - 檢查錯誤處理邏輯

4. **Jest 配置警告** ✅ (已解決)
   - 更新為新的 `transform` 配置格式
   - 移除無效的配置選項

### 除錯步驟

1. 檢查建置輸出
2. 執行單元測試
3. 查看 Cursor 開發者工具
4. 檢查 MCP 伺服器日誌
5. 驗證 JSON-RPC 訊息格式

## 下一步行動

由於 Task 1.1 已完成，接下來應該：

1. **立即開始 Task 1.2**：定義核心型別 (`src/types.ts`)
2. **建立測試資料**：創建 `tests/fixtures/sample-holidays.json`
3. **設定測試工具**：建立 `tests/utils/test-helpers.ts`
4. **準備 Task 1.3**：規劃基礎 MCP 伺服器實作 