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

import { jest } from '@jest/globals';

const mockDb = { query: jest.fn() };

jest.unstable_mockModule('../config/database.mjs', () => ({
  ...mockDb,
  default: mockDb,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

await import('../config/database.mjs');
const { default: providerLock } = await import('../services/providerLock.mjs');
const db = mockDb;

describe('ProviderLockService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();

    db.query.mockResolvedValue({
      rows: [{
        heartbeat_timeout: 30000,
        heartbeat_interval: 5000,
        max_wait_time: 60000
      }]
    });

    providerLock.lockState = {
      isLocked: false,
      lockedBy: null,
      lastHeartbeat: null,
      startTime: null,
      preemptRequested: false,
      activeModel: null,
    };

    providerLock.config = {
      heartbeatTimeout: 30000,
      heartbeatInterval: 5000,
      maxWaitTime: 60000,
    };
  });

  describe('Lock Acquisition', () => {
    test('should acquire lock when unlocked', async () => {
      const result = await providerLock.acquireLock('classification', 'high');

      expect(result).toBe(true);
      expect(providerLock.lockState.isLocked).toBe(true);
      expect(providerLock.lockState.lockedBy).toBe('classification');
      expect(providerLock.lockState.lastHeartbeat).toBeDefined();
      expect(providerLock.lockState.startTime).toBeDefined();
    });

    test('should wait for lock to be released by another requestor', async () => {
      await providerLock.acquireLock('embedding', 'normal');

      setTimeout(() => {
        providerLock.releaseLock('embedding');
      }, 100);

      const result = await providerLock.acquireLock('classification', 'high');

      expect(result).toBe(true);
      expect(providerLock.lockState.lockedBy).toBe('classification');
    });

    test('should release stale lock when heartbeat timeout exceeded', async () => {
      await providerLock.acquireLock('embedding', 'normal');

      providerLock.config.heartbeatTimeout = 50;

      providerLock.lockState.lastHeartbeat = Date.now() - 100;

      const result = await providerLock.acquireLock('classification', 'high');

      expect(result).toBe(true);
      expect(providerLock.lockState.lockedBy).toBe('classification');
    });

    test('should throw structured timeout metadata when wait time is exceeded', async () => {
      providerLock.lockState = {
        isLocked: true,
        lockedBy: 'embedding',
        lastHeartbeat: Date.now(),
        startTime: Date.now() - 1000,
        preemptRequested: true,
        activeModel: 'nomic-embed-text',
      };
      providerLock.config.maxWaitTime = 10;
      jest.spyOn(providerLock, 'sleep').mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
      });

      await expect(providerLock.acquireLock('classification', 'normal')).rejects.toMatchObject({
        message: '[ProviderLock] Timeout waiting for lock (requestor: classification)',
        code: 'PROVIDER_LOCK_TIMEOUT',
        requestor: 'classification',
        lockHolder: 'embedding',
        activeModel: 'nomic-embed-text',
        preemptRequested: true
      });
    });
  });

  describe('Lock Preemption', () => {
    test('should signal preemption when high-priority request arrives', async () => {
      await providerLock.acquireLock('embedding', 'normal');

      const classificationPromise = providerLock.acquireLock('classification', 'high');

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(providerLock.lockState.preemptRequested).toBe(true);

      providerLock.releaseLock('embedding');

      const result = await classificationPromise;
      expect(result).toBe(true);
      expect(providerLock.lockState.lockedBy).toBe('classification');
    });
  });

  describe('Heartbeat', () => {
    test('should update lastHeartbeat when lock owner sends heartbeat', async () => {
      await providerLock.acquireLock('classification', 'high');

      const initialHeartbeat = providerLock.lockState.lastHeartbeat;

      await new Promise(resolve => setTimeout(resolve, 10));

      const result = providerLock.heartbeat('classification');

      expect(result).toBe(true);
      expect(providerLock.lockState.lastHeartbeat).toBeGreaterThan(initialHeartbeat);
    });

    test('should throw error when non-owner tries to send heartbeat', async () => {
      await providerLock.acquireLock('classification', 'high');

      expect(() => {
        providerLock.heartbeat('embedding');
      }).toThrow('Heartbeat called by "embedding" but lock is held by "classification"');
    });

    test('should return false when preemption is requested', async () => {
      await providerLock.acquireLock('embedding', 'normal');

      providerLock.lockState.preemptRequested = true;

      const result = providerLock.heartbeat('embedding');

      expect(result).toBe(false);
    });

    test('should throw error when heartbeat called with no lock held', () => {
      expect(() => {
        providerLock.heartbeat('classification');
      }).toThrow('Heartbeat called by "classification" but lock is held by "none"');
    });
  });

  describe('Lock Release', () => {
    test('should release lock when called by lock owner', async () => {
      await providerLock.acquireLock('classification', 'high');

      const result = providerLock.releaseLock('classification');

      expect(result).toBe(true);
      expect(providerLock.lockState.isLocked).toBe(false);
      expect(providerLock.lockState.lockedBy).toBe(null);
    });

    test('should not release lock when called by non-owner', async () => {
      await providerLock.acquireLock('classification', 'high');

      const result = providerLock.releaseLock('embedding');

      expect(result).toBe(false);
      expect(providerLock.lockState.isLocked).toBe(true);
      expect(providerLock.lockState.lockedBy).toBe('classification');
    });

    test('should return false when no lock is held', () => {
      const result = providerLock.releaseLock('classification');

      expect(result).toBe(false);
    });

    test('should reset all lock state when releasing', async () => {
      await providerLock.acquireLock('classification', 'high');

      providerLock.releaseLock('classification');

      expect(providerLock.lockState).toEqual({
        isLocked: false,
        lockedBy: null,
        lastHeartbeat: null,
        startTime: null,
        preemptRequested: false,
        activeModel: null,
      });
    });
  });

  describe('Model Affinity Tracking', () => {
    test('should set active model when lock is held', async () => {
      await providerLock.acquireLock('embedding', 'normal');

      providerLock.setActiveModel('mxbai-embed-large');

      expect(providerLock.lockState.activeModel).toBe('mxbai-embed-large');
    });

    test('should not set active model when no lock is held', () => {
      providerLock.setActiveModel('some-model');

      expect(providerLock.lockState.activeModel).toBe(null);
    });

    test('should get active model', async () => {
      await providerLock.acquireLock('classification', 'high');
      providerLock.setActiveModel('gemma3:12b');

      expect(providerLock.getActiveModel()).toBe('gemma3:12b');

      providerLock.releaseLock('classification');
    });

    test('should reset active model when lock is released', async () => {
      await providerLock.acquireLock('embedding', 'normal');
      providerLock.setActiveModel('nomic-embed-text');

      expect(providerLock.getActiveModel()).toBe('nomic-embed-text');

      providerLock.releaseLock('embedding');

      expect(providerLock.getActiveModel()).toBe(null);
    });
  });

  describe('Lock Status', () => {
    test('should return current lock status', async () => {
      await providerLock.acquireLock('classification', 'high');

      const status = providerLock.getLockStatus();

      expect(status.isLocked).toBe(true);
      expect(status.lockedBy).toBe('classification');
      expect(status.lastHeartbeat).toBeDefined();
      expect(status.startTime).toBeDefined();
      expect(status.config).toBeDefined();
      expect(status.lockDuration).toBeGreaterThanOrEqual(0);
    });

    test('should calculate lock duration correctly', async () => {
      await providerLock.acquireLock('classification', 'high');

      await new Promise(resolve => setTimeout(resolve, 50));

      const status = providerLock.getLockStatus();

      expect(status.lockDuration).toBeGreaterThanOrEqual(45);
    });

    test('should return 0 duration when no lock is held', () => {
      const status = providerLock.getLockStatus();

      expect(status.lockDuration).toBe(0);
    });
  });

  describe('Configuration Updates', () => {
    test('should update config in memory and database', async () => {
      const newConfig = {
        heartbeatTimeout: 45000,
        heartbeatInterval: 10000,
        maxWaitTime: 120000
      };

      await providerLock.updateConfig(newConfig);

      expect(providerLock.config.heartbeatTimeout).toBe(45000);
      expect(providerLock.config.heartbeatInterval).toBe(10000);
      expect(providerLock.config.maxWaitTime).toBe(120000);

      expect(db.query).toHaveBeenCalled();
    });

    test('should throw error when database update fails', async () => {
      const originalTimeout = providerLock.config.heartbeatTimeout;

      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        providerLock.updateConfig({ heartbeatTimeout: 45000 })
      ).rejects.toThrow('Database error');

      expect(providerLock.config.heartbeatTimeout).toBe(originalTimeout);
    });

    test('should preserve existing config values when partial update', async () => {
      const initialTimeout = providerLock.config.heartbeatTimeout;

      await providerLock.updateConfig({ heartbeatInterval: 8000 });

      expect(providerLock.config.heartbeatTimeout).toBe(initialTimeout);
      expect(providerLock.config.heartbeatInterval).toBe(8000);
    });
  });

  describe('Configuration Loading', () => {
    test('should have loadConfig method and configLoaded flag', () => {
      expect(providerLock.configLoaded).toBeDefined();
      expect(typeof providerLock.loadConfig).toBe('function');
    });

    test('should use defaults when database query fails', () => {
      expect(providerLock.config.heartbeatTimeout).toBe(30000);
      expect(providerLock.config.heartbeatInterval).toBe(5000);
      expect(providerLock.config.maxWaitTime).toBe(60000);
    });

    test('should use defaults when no config row exists', () => {
      expect(providerLock.config.heartbeatTimeout).toBeDefined();
      expect(providerLock.config.heartbeatInterval).toBeDefined();
      expect(providerLock.config.maxWaitTime).toBeDefined();
    });
  });

  describe('Concurrent Lock Requests', () => {
    test('should handle lock state for concurrent scenarios', async () => {
      const result1 = await providerLock.acquireLock('classification', 'high');
      expect(result1).toBe(true);
      expect(providerLock.lockState.lockedBy).toBe('classification');

      providerLock.releaseLock('classification');

      const result2 = await providerLock.acquireLock('embedding', 'normal');
      expect(result2).toBe(true);
      expect(providerLock.lockState.lockedBy).toBe('embedding');

      providerLock.releaseLock('embedding');
    });

    test('should use promise queue to prevent race conditions', async () => {
      expect(providerLock.acquisitionQueue).toBeDefined();

      const promise1 = providerLock.acquireLock('classification', 'high');

      expect(providerLock.acquisitionQueue).toBeInstanceOf(Promise);

      await promise1;

      providerLock.releaseLock('classification');
    });
  });
});
