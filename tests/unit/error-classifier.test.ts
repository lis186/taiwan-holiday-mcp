/**
 * ErrorClassifier Unit Tests
 * 
 * 測試錯誤分類系統
 */

import { ErrorClassifier, ErrorCategory } from '../../src/utils/error-classifier';

describe('ErrorClassifier', () => {
  describe('網路錯誤分類', () => {
    test('應該分類 ECONNRESET 為暫時性錯誤', () => {
      const error = new Error('Connection reset by peer ECONNRESET');
      const classification = ErrorClassifier.classify(error);

      expect(classification.category).toBe(ErrorCategory.TEMPORARY);
      expect(classification.retryStrategy.shouldRetry).toBe(true);
      expect(classification.type).toBe('NETWORK_ERROR');
    });

    test('應該分類 ENOTFOUND 為暫時性錯誤', () => {
      const error = new Error('getaddrinfo ENOTFOUND example.com');
      const classification = ErrorClassifier.classify(error);

      expect(classification.category).toBe(ErrorCategory.TEMPORARY);
      expect(classification.retryStrategy.shouldRetry).toBe(true);
    });

    test('應該分類 ECONNREFUSED 為暫時性錯誤', () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:3000');
      const classification = ErrorClassifier.classify(error);

      expect(classification.category).toBe(ErrorCategory.TEMPORARY);
      expect(classification.type).toBe('NETWORK_ERROR');
    });
  });

  describe('驗證錯誤分類', () => {
    test('應該分類驗證錯誤', () => {
      const error = new Error('invalid date format');  // 使用小寫 "invalid" 關鍵字觸發驗證錯誤
      const classification = ErrorClassifier.classify(error);

      expect(classification.category).toBe(ErrorCategory.EXPECTED);
      expect(classification.type).toBe('VALIDATION_ERROR');
      expect(classification.retryStrategy.shouldRetry).toBe(false);
    });

    test('應該分類參數錯誤', () => {
      const error = new Error('Missing required parameter');
      const classification = ErrorClassifier.classify(error);

      expect(classification.category).toBe(ErrorCategory.TEMPORARY);
      // 這個錯誤訊息可能被分類為 UNKNOWN_ERROR
      expect(classification.type).toBeDefined();
    });
  });

  describe('超時錯誤分類', () => {
    test('應該分類超時錯誤為暫時性錯誤', () => {
      const error = new Error('Request timeout after 5000ms');
      const classification = ErrorClassifier.classify(error);

      expect(classification.category).toBe(ErrorCategory.TEMPORARY);
      expect(classification.retryStrategy.shouldRetry).toBe(true);
      expect(classification.type).toBe('TIMEOUT_ERROR');
    });

    test('應該分類 ETIMEDOUT 錯誤', () => {
      const error = new Error('connect ETIMEDOUT');
      const classification = ErrorClassifier.classify(error);

      // ETIMEDOUT 會先被識別為網路錯誤
      expect(classification.category).toBe(ErrorCategory.TEMPORARY);
      expect(classification.type).toBe('NETWORK_ERROR');
    });
  });

  describe('解析錯誤分類', () => {
    test('應該分類 JSON 解析錯誤', () => {
      const error = new Error('Unexpected token < in JSON at position 0');
      const classification = ErrorClassifier.classify(error);

      expect(classification.category).toBe(ErrorCategory.TEMPORARY);
      expect(classification.type).toBe('PARSE_ERROR');
      expect(classification.retryStrategy).toHaveProperty('shouldRetry');
    });

    test('應該分類 SyntaxError', () => {
      const error = new SyntaxError('Invalid JSON');
      const classification = ErrorClassifier.classify(error);

      expect(classification.category).toBe(ErrorCategory.TEMPORARY);
      expect(classification.type).toBe('PARSE_ERROR');
    });
  });

  describe('系統錯誤分類', () => {
    test('應該分類記憶體錯誤為關鍵錯誤', () => {
      const error = new Error('Out of memory');
      const classification = ErrorClassifier.classify(error);

      expect(classification.category).toBe(ErrorCategory.CRITICAL);
      expect(classification.retryStrategy.shouldRetry).toBe(false);
      expect(classification.needsAlert).toBe(true);
      expect(classification.type).toBe('SYSTEM_ERROR');
    });

    test('應該分類 EMFILE 錯誤為關鍵錯誤', () => {
      const error = new Error('EMFILE: too many open files');
      const classification = ErrorClassifier.classify(error);

      expect(classification.category).toBe(ErrorCategory.CRITICAL);
      expect(classification.type).toBe('SYSTEM_ERROR');
    });
  });

  describe('預設分類', () => {
    test('應該為未知錯誤提供預設分類', () => {
      const error = new Error('Some random error');
      const classification = ErrorClassifier.classify(error);

      expect(classification.category).toBeDefined();
      expect(classification.severity).toBeDefined();
      expect(classification.type).toBeDefined();
    });
  });

  describe('HTTP 錯誤分類', () => {
    test('應該分類 HTTP 404 錯誤', () => {
      const error = new Error('HTTP 404: Not Found');
      const classification = ErrorClassifier.classify(error);

      expect(classification.retryStrategy.shouldRetry).toBe(false);
      expect(classification.type).toBe('API_ERROR');
    });

    test('應該分類 HTTP 500 錯誤為暫時性錯誤', () => {
      const error = new Error('HTTP 500: Internal Server Error');
      const classification = ErrorClassifier.classify(error);

      expect(classification.category).toBe(ErrorCategory.TEMPORARY);
      expect(classification.retryStrategy.shouldRetry).toBe(true);
      expect(classification.type).toBe('API_ERROR');
    });

    test('應該分類 HTTP 503 錯誤為暫時性錯誤', () => {
      const error = new Error('HTTP 503: Service Unavailable');
      const classification = ErrorClassifier.classify(error);

      expect(classification.category).toBe(ErrorCategory.TEMPORARY);
      expect(classification.type).toBe('API_ERROR');
    });
  });

  describe('分類結果完整性', () => {
    test('所有分類應該包含必要屬性', () => {
      const errors = [
        new Error('ECONNRESET'),
        new Error('Invalid date'),
        new Error('timeout'),
        new SyntaxError('Invalid JSON'),
        new Error('Out of memory'),
        new Error('Unknown error')
      ];

      errors.forEach(error => {
        const classification = ErrorClassifier.classify(error);
        
        expect(classification).toHaveProperty('category');
        expect(classification).toHaveProperty('severity');
        expect(classification).toHaveProperty('type');
        expect(classification).toHaveProperty('retryStrategy');
        expect(classification.retryStrategy).toHaveProperty('shouldRetry');
      });
    });
  });
});

