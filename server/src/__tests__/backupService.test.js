/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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

// Mock fs module to avoid environment-specific filesystem behavior
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn(),
    access: jest.fn(),
    stat: jest.fn(),
  }
}));

const fs = require('fs').promises;
const backupService = require('../services/backupService');

describe('BackupService - Encryption/Decryption', () => {
  const testData = {
    version: '2.0',
    data: {
      test: 'value',
      nested: { key: 'data' },
      array: [1, 2, 3]
    }
  };
  const password = 'TestPassword123!';

  test('should encrypt and decrypt data successfully', () => {
    const encrypted = backupService.encrypt(testData, password);
    expect(encrypted).toBeTruthy();
    expect(typeof encrypted).toBe('string');
    
    const decrypted = backupService.decrypt(encrypted, password);
    expect(decrypted).toEqual(testData);
  });

  test('should fail to decrypt with wrong password', () => {
    const encrypted = backupService.encrypt(testData, password);
    
    expect(() => {
      backupService.decrypt(encrypted, 'WrongPassword');
    }).toThrow('Invalid password or corrupted backup file');
  });

  test('should produce different encrypted output each time', () => {
    const encrypted1 = backupService.encrypt(testData, password);
    const encrypted2 = backupService.encrypt(testData, password);
    
    // Due to random IV and salt, encrypted strings should differ
    expect(encrypted1).not.toBe(encrypted2);
    
    // But both should decrypt to same data
    const decrypted1 = backupService.decrypt(encrypted1, password);
    const decrypted2 = backupService.decrypt(encrypted2, password);
    expect(decrypted1).toEqual(testData);
    expect(decrypted2).toEqual(testData);
  });

  test('should handle complex nested objects', () => {
    const complexData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      data: {
        users: [
          { id: 1, username: 'admin', role: 'admin' },
          { id: 2, username: 'user', role: 'user' }
        ],
        libraries: [
          { id: 1, name: 'Movies', type: 'movie' },
          { id: 2, name: 'TV', type: 'tv' }
        ],
        settings: {
          confidence: { threshold: 80 },
          ai: { provider: 'ollama', model: 'llama2' }
        }
      },
      meta: {
        usersCount: 2,
        librariesCount: 2
      }
    };

    const encrypted = backupService.encrypt(complexData, password);
    const decrypted = backupService.decrypt(encrypted, password);
    expect(decrypted).toEqual(complexData);
  });

  test('should handle empty data', () => {
    const emptyData = { data: {} };
    const encrypted = backupService.encrypt(emptyData, password);
    const decrypted = backupService.decrypt(encrypted, password);
    expect(decrypted).toEqual(emptyData);
  });

  test('should handle unicode characters', () => {
    const unicodeData = {
      data: {
        title: '映画タイトル',
        description: 'Película española 🎬',
        emoji: '🔒💾🎯'
      }
    };
    const encrypted = backupService.encrypt(unicodeData, password);
    const decrypted = backupService.decrypt(encrypted, password);
    expect(decrypted).toEqual(unicodeData);
  });
});

describe('BackupService - Password Validation', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    jest.resetAllMocks();
  });

  test('should reject password shorter than 8 characters', async () => {
    await expect(
      backupService.createBackup({
        encrypted: true,
        password: 'short',
        includePatterns: false
      })
    ).rejects.toThrow('Password must be at least 8 characters');
    
    // Should fail before attempting directory creation
    expect(fs.mkdir).not.toHaveBeenCalled();
  });

  test('should accept password with exactly 8 characters', async () => {
    // Mock directory creation to fail so we can verify password validation passed
    fs.mkdir.mockRejectedValue({
      code: 'EACCES',
      message: 'Permission denied'
    });
    
    await expect(
      backupService.createBackup({
        encrypted: true,
        password: '12345678',
        includePatterns: false
      })
    ).rejects.toThrow('Failed to create backup directory');
    
    // Password validation should pass, so mkdir should be called
    expect(fs.mkdir).toHaveBeenCalled();
  });

  test('should reject empty password for encrypted backup', async () => {
    await expect(
      backupService.createBackup({
        encrypted: true,
        password: '',
        includePatterns: false
      })
    ).rejects.toThrow('Password must be at least 8 characters');
    
    // Should fail before attempting directory creation
    expect(fs.mkdir).not.toHaveBeenCalled();
  });

  test('should allow plaintext backup without password', async () => {
    // Mock directory creation to fail so we can verify password validation passed
    fs.mkdir.mockRejectedValue({
      code: 'EACCES',
      message: 'Permission denied'
    });
    
    await expect(
      backupService.createBackup({
        encrypted: false,
        includePatterns: false
      })
    ).rejects.toThrow('Failed to create backup directory');
    
    // Password validation should pass (no password required for plaintext), so mkdir should be called
    expect(fs.mkdir).toHaveBeenCalled();
  });
});

describe('BackupService - Key Derivation', () => {
  test('should produce consistent key from same password and salt', () => {
    const password = 'TestPassword123!';
    const salt = Buffer.from('test-salt-16bytes');
    
    const key1 = backupService.deriveKey(password, salt);
    const key2 = backupService.deriveKey(password, salt);
    
    expect(key1.equals(key2)).toBe(true);
  });

  test('should produce different keys from different passwords', () => {
    const salt = Buffer.from('test-salt-16bytes');
    
    const key1 = backupService.deriveKey('Password1', salt);
    const key2 = backupService.deriveKey('Password2', salt);
    
    expect(key1.equals(key2)).toBe(false);
  });

  test('should produce different keys from different salts', () => {
    const password = 'TestPassword123!';
    
    const key1 = backupService.deriveKey(password, Buffer.from('salt1-16bytes---'));
    const key2 = backupService.deriveKey(password, Buffer.from('salt2-16bytes---'));
    
    expect(key1.equals(key2)).toBe(false);
  });

  test('should produce 32-byte key', () => {
    const password = 'TestPassword123!';
    const salt = Buffer.from('test-salt-16bytes');
    
    const key = backupService.deriveKey(password, salt);
    expect(key.length).toBe(32);
  });
});

describe('BackupService - Data Integrity', () => {
  test('should maintain data types through encryption cycle', () => {
    const testData = {
      string: 'text',
      number: 42,
      float: 3.14,
      boolean: true,
      null: null,
      array: [1, 'two', 3],
      object: { nested: 'value' }
    };
    const password = 'TestPassword123!';
    
    const encrypted = backupService.encrypt(testData, password);
    const decrypted = backupService.decrypt(encrypted, password);
    
    expect(typeof decrypted.string).toBe('string');
    expect(typeof decrypted.number).toBe('number');
    expect(typeof decrypted.float).toBe('number');
    expect(typeof decrypted.boolean).toBe('boolean');
    expect(decrypted.null).toBe(null);
    expect(Array.isArray(decrypted.array)).toBe(true);
    expect(typeof decrypted.object).toBe('object');
  });

  test('should handle special characters in data', () => {
    const testData = {
      special: 'Test with special chars: \n\t\r\\"\' & < > @ # $ % ^ * ( ) { } [ ]',
      quotes: "He said \"hello\" and she said 'hi'",
      backslash: 'C:\\Users\\Path\\To\\File'
    };
    const password = 'TestPassword123!';
    
    const encrypted = backupService.encrypt(testData, password);
    const decrypted = backupService.decrypt(encrypted, password);
    expect(decrypted).toEqual(testData);
  });

  test('should handle large datasets', () => {
    // Create a larger dataset
    const largeData = {
      version: '2.0',
      data: {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `Description for item ${i}`.repeat(10)
        }))
      }
    };
    const password = 'TestPassword123!';
    
    const encrypted = backupService.encrypt(largeData, password);
    const decrypted = backupService.decrypt(encrypted, password);
    
    expect(decrypted.data.items.length).toBe(1000);
    expect(decrypted.data.items[500]).toEqual(largeData.data.items[500]);
  });
});

describe('BackupService - Error Handling', () => {
  test('should throw error for corrupted encrypted data', () => {
    const password = 'TestPassword123!';
    const corruptedData = 'this-is-not-valid-encrypted-data';
    
    expect(() => {
      backupService.decrypt(corruptedData, password);
    }).toThrow();
  });

  test('should throw error for truncated encrypted data', () => {
    const testData = { data: 'test' };
    const password = 'TestPassword123!';
    
    const encrypted = backupService.encrypt(testData, password);
    const truncated = encrypted.substring(0, encrypted.length - 10);
    
    expect(() => {
      backupService.decrypt(truncated, password);
    }).toThrow();
  });

  test('should throw error for tampered encrypted data', () => {
    const testData = { data: 'test' };
    const password = 'TestPassword123!';
    
    const encrypted = backupService.encrypt(testData, password);
    // Modify a character in the middle
    const tampered = encrypted.substring(0, 50) + 
                     (encrypted.charAt(50) === 'A' ? 'B' : 'A') + 
                     encrypted.substring(51);
    
    expect(() => {
      backupService.decrypt(tampered, password);
    }).toThrow();
  });
});

describe('BackupService - Filesystem Operations', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    jest.resetAllMocks();
  });

  test('should handle directory creation success', async () => {
    // Mock successful directory creation
    fs.mkdir.mockResolvedValue(undefined);
    
    await expect(backupService.ensureBackupDirectory()).resolves.toBeUndefined();
    
    expect(fs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('backups'),
      { recursive: true }
    );
  });

  test('should handle directory creation failure with EACCES', async () => {
    // Mock mkdir to fail with permission error
    fs.mkdir.mockRejectedValue({
      code: 'EACCES',
      message: 'Permission denied'
    });
    
    await expect(backupService.ensureBackupDirectory())
      .rejects.toThrow('Failed to create backup directory');
    
    expect(fs.mkdir).toHaveBeenCalled();
  });

  test('should handle directory creation failure with ENOSPC', async () => {
    // Mock mkdir to fail with no space error
    fs.mkdir.mockRejectedValue({
      code: 'ENOSPC',
      message: 'No space left on device'
    });
    
    await expect(backupService.ensureBackupDirectory())
      .rejects.toThrow('Failed to create backup directory');
    
    expect(fs.mkdir).toHaveBeenCalled();
  });

  test('should validate password before attempting directory operations', async () => {
    // Password validation should fail before any filesystem operations
    await expect(
      backupService.createBackup({
        encrypted: true,
        password: 'short',
        includePatterns: false
      })
    ).rejects.toThrow('Password must be at least 8 characters');
    
    // No filesystem operations should be attempted
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
});
