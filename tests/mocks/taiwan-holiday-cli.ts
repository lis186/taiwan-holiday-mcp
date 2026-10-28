/**
 * taiwan-holiday-cli 是純 ESM 套件，本 repo 的 jest 以 CJS 轉譯執行，無法直接載入。
 * 透過 jest.config.js 的 moduleNameMapper 改指向這個替身；
 * 判斷規則本身由 taiwan-holiday-cli 自己的測試涵蓋。
 */
export const getTyphoonService = jest.fn();
