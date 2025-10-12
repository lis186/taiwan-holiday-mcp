# 測試修復與覆蓋率提升 - 2025-10-12

## 問題描述

執行 `npm test` 時發現：
- 5 個測試失敗
- 分支覆蓋率 79.75% < 80% 門檻

## 修復內容

### 1. health-monitor.test.ts 記憶體測試修復

**問題**：測試依賴實際記憶體使用情況，在不同環境下可能不一致

**解決方案**：
```typescript
// Mock process.memoryUsage() 返回可預測的值
const originalMemoryUsage = process.memoryUsage;
process.memoryUsage = jest.fn().mockReturnValue({
  heapUsed: 50 * 1024 * 1024,  // 50 MB
  heapTotal: 100 * 1024 * 1024, // 100 MB
  external: 0,
  arrayBuffers: 0,
  rss: 0,
});
```

### 2. index.test.ts 除錯輸出測試修復

**問題**：輸出被緩衝，進程過早終止導致測試失敗

**解決方案**：
```typescript
// 延長除錯模式等待時間
const timeout = args.includes('--debug') ? 2000 : 1000;
```

### 3. build-and-package.test.ts 打包測試修復

**問題**：`npm pack --dry-run` 需要先執行 build，預設 timeout 5000ms 不足

**解決方案**：
```typescript
const result = await runCommand('npm', ['run', 'package:test'], { timeout: 30000 });
```

### 4. error-classifier 測試新增

**新增文件**：`tests/unit/error-classifier.test.ts`

**內容**：16 個測試案例，覆蓋：
- 網路錯誤分類（ECONNRESET, ENOTFOUND, ECONNREFUSED）
- 驗證錯誤分類
- 超時錯誤分類
- 解析錯誤分類（JSON, SyntaxError）
- 系統錯誤分類（記憶體、檔案限制）
- HTTP 錯誤分類（404, 500, 503）
- 預設分類
- 分類結果完整性驗證

## 結果

### 測試通過率
- **修復前**：425/432 通過（98.4%），5 個失敗
- **修復後**：446/448 通過（99.5%），0 個失敗

### 覆蓋率提升
- **修復前**：
  - Statements: 91.28%
  - Branches: 79.75% ❌
  - Functions: 87.86%
  - Lines: 91.32%

- **修復後**：
  - Statements: 92.27% ✅
  - Branches: 82.24% ✅ (+2.49%)
  - Functions: 89.80% ✅
  - Lines: 92.34% ✅

### error-classifier 覆蓋率改善
- **修復前**：65.71% 分支覆蓋率
- **修復後**：88.57% 分支覆蓋率（+22.86%）

## 技術要點

1. **Mock 測試環境一致性**：對於依賴系統資源的測試，使用 Mock 確保可重現性
2. **非同步輸出處理**：給予足夠的緩衝時間讓輸出完全被捕獲
3. **長時間任務 Timeout**：建置和打包任務需要更長的等待時間
4. **錯誤分類測試**：根據實際 API 行為編寫測試，而非假設行為

## 版本更新

- 版本號：1.0.4 → 1.0.5
- 更新文件：package.json, 測試文件

## 完成時間

2025-10-12，總計約 1.5 小時

