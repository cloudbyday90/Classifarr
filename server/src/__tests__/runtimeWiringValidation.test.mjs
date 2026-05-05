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

  test('validateRuntimeWiringChecks requires an importModule function', async () => {
    await expect(validateRuntimeWiringChecks({ checks: [] })).rejects.toThrow(
      'validateRuntimeWiringChecks requires an importModule function'
    );
  });

  test('validateRuntimeWiringChecks collects validation and load failures', async () => {
    const logger = {
      info: jest.fn(),
      error: jest.fn(),
    };
    const checks = createRuntimeWiringChecks();
    const importModule = jest.fn(async (modulePath) => {
      if (modulePath === '../utils/operationController.mjs') {
        return {};
      }

      if (modulePath === './classification.mjs') {
        throw new Error('broken import');
      }

      return { logStageEvent: jest.fn() };
    });

    const result = await validateRuntimeWiringChecks({ checks, importModule, logger });

    expect(result.ok).toBe(false);
    expect(result.checked).toBe(3);
    expect(result.issues).toEqual([
      {
        module: '../utils/operationController.mjs',
        expected: 'named export OperationController as a constructor function',
        actual: 'undefined'
      },
      {
        module: './classification.mjs',
        expected: 'classification service with withTimeout function',
        actual: 'load_failed: broken import'
      }
    ]);
    expect(logger.error).toHaveBeenCalledWith('Runtime wiring validation failed', {
      checked: 3,
      issues: result.issues
    });
  });
});
