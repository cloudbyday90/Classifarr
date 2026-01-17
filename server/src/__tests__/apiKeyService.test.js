/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const apiKeyService = require('../services/apiKeyService');

describe('API Key Service - generateApiKey', () => {
  test('should generate API key with correct format', () => {
    const { key, encrypted, iv, authTag, prefix } = apiKeyService.generateApiKey();
    
    expect(key).toMatch(/^clf_[A-Za-z0-9_-]{32}$/);
    expect(prefix).toBe(key.substring(0, 8));
    expect(prefix).toMatch(/^clf_[A-Za-z0-9_-]{4}$/);
    expect(encrypted).toBeDefined();
    expect(iv).toBeDefined();
    expect(authTag).toBeDefined();
  });

  test('should generate unique keys', () => {
    const key1 = apiKeyService.generateApiKey();
    const key2 = apiKeyService.generateApiKey();
    
    expect(key1.key).not.toBe(key2.key);
    expect(key1.encrypted).not.toBe(key2.encrypted);
  });

  test('should generate keys with valid base64url encoding', () => {
    const { key } = apiKeyService.generateApiKey();
    const keyPart = key.substring(4); // Remove 'clf_' prefix
    
    // base64url should not contain +, /, or =
    expect(keyPart).not.toMatch(/[+/=]/);
  });

  test('should generate 32-character key suffix (after clf_)', () => {
    const { key } = apiKeyService.generateApiKey();
    const keyPart = key.substring(4);
    
    expect(keyPart.length).toBe(32);
  });
});

describe('API Key Service - Key Format Validation', () => {
  test('should have consistent prefix format', () => {
    for (let i = 0; i < 10; i++) {
      const { prefix } = apiKeyService.generateApiKey();
      expect(prefix).toHaveLength(8);
      expect(prefix.startsWith('clf_')).toBe(true);
    }
  });

  test('should create keys that start with clf_', () => {
    for (let i = 0; i < 5; i++) {
      const { key } = apiKeyService.generateApiKey();
      expect(key.startsWith('clf_')).toBe(true);
    }
  });
});

describe('API Key Service - Encryption/Decryption', () => {
  test('encrypted key should be different from original', () => {
    const { key, encrypted } = apiKeyService.generateApiKey();
    
    expect(encrypted).not.toBe(key);
    expect(encrypted).toBeDefined();
  });

  test('should have iv and authTag for encryption', () => {
    const { iv, authTag } = apiKeyService.generateApiKey();
    
    expect(iv).toBeDefined();
    expect(authTag).toBeDefined();
    expect(typeof iv).toBe('string');
    expect(typeof authTag).toBe('string');
  });
});
