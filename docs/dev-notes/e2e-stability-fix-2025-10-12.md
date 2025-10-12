# E2E 測試穩定性修復

**日期**: 2025-10-12  
**問題**: E2E 測試不穩定，間歇性超時失敗

## 問題分析

### 根本原因

Jest 測試級別 timeout 與命令執行 timeout 不同步：

```typescript
// ❌ 錯誤：Jest 預設 timeout 10000ms，但命令需要 30000ms
test('應該能夠成功打包', async () => {
  const result = await runCommand('npm', ['run', 'package:test'], { timeout: 30000 });
  // Jest 在 10 秒後就中斷測試，即使 runCommand 設定了 30 秒
});
```

**執行結果**：
```
✕ 應該能夠成功打包 (10010 ms)
thrown: "Exceeded timeout of 10000 ms for a test.
```

### 原理說明

1. **runCommand timeout**: 控制子進程執行時間，30 秒後 kill 子進程
2. **Jest test timeout**: 控制整個測試函數執行時間，預設 10 秒
3. **衝突**: Jest 在 10 秒後就拋出 timeout 錯誤，runCommand 還沒完成

## 修復方案

在 `test()` 的第三個參數設置 Jest 測試 timeout，**必須略大於命令 timeout**：

```typescript
// ✅ 正確：Jest timeout > runCommand timeout
test('應該能夠成功打包', async () => {
  const result = await runCommand('npm', ['run', 'package:test'], { timeout: 30000 });
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('taiwan-holiday-mcp-1.0.5.tgz');
}, 35000); // Jest timeout 35秒 > runCommand timeout 30秒
```

## 修復清單

### 1. build-and-package.test.ts

- **測試**: "應該能夠成功打包"
  - runCommand timeout: 30000ms
  - Jest timeout: 35000ms (新增)
  
- **測試**: "打包內容應該包含必要檔案"
  - runCommand timeout: 15000ms (從 10000ms 提升)
  - Jest timeout: 20000ms (新增)

### 2. build-and-package-simple.test.ts

- **測試**: "應該能夠成功打包"
  - 無命令 timeout（使用預設）
  - Jest timeout: 40000ms (新增，因為包含 npm install + build + pack)

## 測試結果

### 修復前
```
✕ 應該能夠成功打包 (10010 ms) - 超時失敗
✕ 打包內容應該包含必要檔案 (10057 ms) - 超時失敗
```

### 修復後
```
✓ 應該能夠成功打包 (4623 ms) - 穩定通過
✓ 打包內容應該包含必要檔案 (3589 ms) - 穩定通過
```

### 完整測試套件
```
Test Suites: 20 passed, 20 total
Tests:       2 skipped, 446 passed, 448 total
Time:        231.782 s
```

**覆蓋率**:
- Statements: 92.27%
- Branches: 82.24%
- Functions: 89.80%
- Lines: 92.34%

## 最佳實踐

### timeout 設定原則

1. **Jest test timeout** 應該略大於 **命令 timeout**
2. 建議公式：`Jest timeout = Command timeout + 5000ms`
3. 長時間操作（build, pack）建議：
   - Build: 20-30 秒
   - Pack: 30-40 秒
   - Install: 40-60 秒

### 範例模式

```typescript
// 短時間命令（< 5秒）
test('快速測試', async () => {
  const result = await runCommand('npm', ['--version']);
  expect(result.exitCode).toBe(0);
}); // 使用預設 5000ms

// 中等時間命令（5-15秒）
test('中等測試', async () => {
  const result = await runCommand('npm', ['run', 'lint'], { timeout: 10000 });
  expect(result.exitCode).toBe(0);
}, 15000); // Jest timeout = 10000 + 5000

// 長時間命令（> 15秒）
test('長時間測試', async () => {
  const result = await runCommand('npm', ['run', 'build'], { timeout: 25000 });
  expect(result.exitCode).toBe(0);
}, 30000); // Jest timeout = 25000 + 5000
```

## 防止復發

### Code Review Checklist

- [ ] 所有 `runCommand` 都有明確的 timeout 參數
- [ ] 所有長時間測試都有 Jest timeout 參數
- [ ] Jest timeout > runCommand timeout
- [ ] timeout 值符合實際執行時間需求

### 監控指標

- 測試執行時間接近 timeout → 需要調整
- 間歇性 timeout 失敗 → 檢查 timeout 設定
- CI/CD 環境測試失敗 → 考慮更長的 timeout（CI 較慢）

## 相關文件

- 測試失敗修復: `docs/dev-notes/test-fixes-2025-10-12.md`
- Jest 配置: `jest.config.ts`
- E2E 測試: `tests/e2e/`

## 學到的教訓

1. **E2E 測試需要充足的 timeout**：不要吝嗇 timeout 時間
2. **兩層 timeout 要同步**：Jest timeout 和命令 timeout 必須協調
3. **CI 環境需要更長時間**：本地 5 秒，CI 可能需要 10 秒
4. **明確勝於隱式**：總是明確設定 timeout，不依賴預設值

