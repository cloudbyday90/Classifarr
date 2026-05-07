/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import {
  createRuntimeWiringChecks,
  describeRuntimeExport,
  validateRuntimeWiringChecks,
} from '../services/shared/runtimeWiringValidation.mjs';

describe('runtimeWiringValidation', () => {
  test('describeRuntimeExport reports stable runtime shapes', () => {
    expect(describeRuntimeExport(null)).toBe('null');
    expect(describeRuntimeExport(undefined)).toBe('undefined');
    expect(describeRuntimeExport([])).toBe('array');
    expect(describeRuntimeExport({})).toBe('object');
    expect(describeRuntimeExport(() => {})).toBe('function');
  });

  test('validateRuntimeWiringChecks returns ok when all checks pass', () => {
    const mockOC = { OperationController: class {} };
    const mockCS = { withTimeout: jest.fn() };
    const mockRL = { logStageEvent: jest.fn() };

    const checks = createRuntimeWiringChecks({
      operationController: mockOC,
      classificationService: mockCS,
      ragLogger: mockRL,
    });

    const result = validateRuntimeWiringChecks({ checks });

    expect(result.ok).toBe(true);
    expect(result.checked).toBe(3);
    expect(result.issues).toHaveLength(0);
  });

  test('validateRuntimeWiringChecks collects validation failures synchronously', () => {
    const logger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    // operationController missing export, classification broken, ragLogger ok
    const checks = createRuntimeWiringChecks({
      operationController: {},
      classificationService: undefined,
      ragLogger: { logStageEvent: jest.fn() },
    });

    const result = validateRuntimeWiringChecks({ checks, logger });

    expect(result.ok).toBe(false);
    expect(result.checked).toBe(3);
    expect(result.issues).toEqual([
      {
        module: 'operationController',
        expected: 'named export OperationController as a constructor function',
        actual: 'undefined',
      },
      {
        module: 'classificationService',
        expected: 'classification service with withTimeout function',
        actual: 'undefined',
      },
    ]);
    expect(logger.error).toHaveBeenCalledWith('Runtime wiring validation failed', {
      checked: 3,
      issues: result.issues,
    });
  });
});
