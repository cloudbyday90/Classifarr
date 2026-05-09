/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };

const mockLoggerModule = {
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
};

const mockOperationControllerModule = {
    OperationController: class OperationController {}
};

const mockClassificationModule = {
    withTimeout: jest.fn()
};

const mockRagLoggerModule = {
    logStageEvent: jest.fn()
};

const mockFsPromises = {
  access: jest.fn()
};

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLoggerModule));

jest.unstable_mockModule('../utils/operationController.mjs', () => createNamedMockModule('operationController', mockOperationControllerModule));

jest.unstable_mockModule('../services/classification.mjs', () => createNamedMockModule('classificationService', mockClassificationModule));

jest.unstable_mockModule('../utils/ragLogger.mjs', () => createNamedMockModule('ragLogger', mockRagLoggerModule));

jest.unstable_mockModule('node:fs/promises', () => createMockModule(mockFsPromises));

const { startupService: StartupService } = await import('../services/startupService.mjs');
const db = mockDb;
const defaultRuntimeWiringChecks = StartupService.runtimeWiringChecks;
describe('StartupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StartupService.runtimeWiringChecks = defaultRuntimeWiringChecks;
  });

  describe('describeRuntimeExport', () => {
    it('should return null for null value', () => {
      expect(StartupService.describeRuntimeExport(null)).toBe('null');
    });

    it('should return undefined for undefined value', () => {
      expect(StartupService.describeRuntimeExport(undefined)).toBe('undefined');
    });

    it('should return array for array value', () => {
      expect(StartupService.describeRuntimeExport([])).toBe('array');
    });

    it('should return typeof for other values', () => {
      expect(StartupService.describeRuntimeExport('test')).toBe('string');
      expect(StartupService.describeRuntimeExport(123)).toBe('number');
      expect(StartupService.describeRuntimeExport({})).toBe('object');
      expect(StartupService.describeRuntimeExport(() => {})).toBe('function');
    });
  });

  describe('validateRuntimeWiring', () => {
    it('should return ok true when all validations pass', () => {
      const result = StartupService.validateRuntimeWiring();
      expect(result.ok).toBe(true);
      expect(result.checked).toBe(3);
      expect(result.issues).toHaveLength(0);
    });

    it('should report validation failures without aborting the full diagnostics pass', () => {
      StartupService.runtimeWiringChecks = [
        defaultRuntimeWiringChecks[0], // operationController — passes
        {
          label: 'classificationService',
          expected: 'classification service with withTimeout function',
          validate: () => false,
          actual: () => 'undefined',
        },
        defaultRuntimeWiringChecks[2], // ragLogger — passes
      ];

      const result = StartupService.validateRuntimeWiring();

      expect(result.ok).toBe(false);
      expect(result.checked).toBe(3);
      expect(result.issues).toContainEqual({
        module: 'classificationService',
        expected: 'classification service with withTimeout function',
        actual: 'undefined',
      });
    });
  });

  describe('checkMappingStatus', () => {
    it('should return not_applicable when no arr configs exist', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await StartupService.checkMappingStatus();

      expect(result.status).toBe('not_applicable');
      expect(result.message).toBe('No Radarr or Sonarr instances configured');
    });

    it('should return migrations_pending when table does not exist', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ exists: false }] });

      const result = await StartupService.checkMappingStatus();

      expect(result.status).toBe('migrations_pending');
    });

    it('should return incomplete when not all libraries mapped', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const result = await StartupService.checkMappingStatus();

      expect(result.status).toBe('incomplete');
      expect(result.mapped).toBe(2);
      expect(result.total).toBe(5);
      expect(result.unmapped).toBe(3);
    });

    it('should return complete when all libraries mapped', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] });

      const result = await StartupService.checkMappingStatus();

      expect(result.status).toBe('complete');
      expect(result.mapped).toBe(3);
      expect(result.total).toBe(3);
    });

    it('should return error on database failure', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const result = await StartupService.checkMappingStatus();

      expect(result.status).toBe('error');
      expect(result.message).toBe('DB error');
    });
  });

  describe('checkMediaPathStatus', () => {
    it('should return not_configured when table does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ exists: false }] });

      const result = await StartupService.checkMediaPathStatus();

      expect(result.status).toBe('not_configured');
    });

    it('should return not_configured when no path set', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await StartupService.checkMediaPathStatus();

      expect(result.status).toBe('not_configured');
      expect(result.path).toBeNull();
      expect(result.accessible).toBe(false);
    });

    it('should return path_not_accessible when path does not exist', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({ rows: [{ value: '/nonexistent/path' }] });

      mockFsPromises.access.mockRejectedValue(new Error('not found'));

      const result = await StartupService.checkMediaPathStatus();

      expect(result.status).toBe('path_not_accessible');
      expect(result.accessible).toBe(false);
    });

    it('should return configured when path is accessible', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({ rows: [{ value: '/media' }] });

      mockFsPromises.access.mockResolvedValue(undefined);

      const result = await StartupService.checkMediaPathStatus();

      expect(result.status).toBe('configured');
      expect(result.path).toBe('/media');
      expect(result.accessible).toBe(true);
    });

    it('should return error on database failure', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const result = await StartupService.checkMediaPathStatus();

      expect(result.status).toBe('error');
    });
  });

  describe('getSetupStatus', () => {
    it('should return complete when all checks pass', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({ rows: [{ value: '/media' }] });

      mockFsPromises.access.mockResolvedValue(undefined);

      const result = await StartupService.getSetupStatus();

      expect(result.status).toBe('complete');
      expect(result.reclassificationEnabled).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should return incomplete when mapping incomplete', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({ rows: [{ value: '/media' }] });

      mockFsPromises.access.mockResolvedValue(undefined);

      const result = await StartupService.getSetupStatus();

      expect(result.status).toBe('incomplete');
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('mapping');
    });

    it('should return incomplete when media path not configured', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await StartupService.getSetupStatus();

      expect(result.status).toBe('incomplete');
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('media_path');
    });

    it('should return optional when no arr configs', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({ rows: [{ value: '/media' }] });

      mockFsPromises.access.mockResolvedValue(undefined);

      const result = await StartupService.getSetupStatus();

      expect(result.status).toBe('optional');
    });
  });

  describe('setMediaPath', () => {
    it('should upsert media path', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await StartupService.setMediaPath('/new/media/path');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app_settings'),
        ['/new/media/path']
      );
    });
  });
});
