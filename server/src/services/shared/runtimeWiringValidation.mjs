/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function describeRuntimeExport(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function createRuntimeWiringChecks(describeExport = describeRuntimeExport) {
  return [
    {
      module: '../utils/operationController.mjs',
      expected: 'named export OperationController as a constructor function',
      validate: (mod) => typeof mod?.OperationController === 'function',
      actual: (mod) => describeExport(mod?.OperationController)
    },
    {
      module: './classification.mjs',
      expected: 'classification service with withTimeout function',
      validate: (svc) => typeof svc?.withTimeout === 'function',
      actual: (svc) => describeExport(svc?.withTimeout)
    },
    {
      module: '../utils/ragLogger.mjs',
      expected: 'rag logger singleton with logStageEvent function',
      validate: (svc) => typeof svc?.logStageEvent === 'function',
      actual: (svc) => describeExport(svc?.logStageEvent)
    }
  ];
}

async function validateRuntimeWiringChecks({ checks, importModule = defaultImportRuntimeModule, logger }) {
  const issues = [];

  for (const check of checks) {
    try {
      const loadedModule = await importModule(check.module);
      if (!check.validate(loadedModule)) {
        issues.push({
          module: check.module,
          expected: check.expected,
          actual: check.actual(loadedModule)
        });
      }
    } catch (error) {
      issues.push({
        module: check.module,
        expected: check.expected,
        actual: `load_failed: ${error.message}`
      });
    }
  }

  const result = {
    ok: issues.length === 0,
    checked: checks.length,
    issues
  };

  if (!logger) {
    return result;
  }

  if (result.ok) {
    logger.info('Runtime wiring validation passed', { checked: checks.length });
    return result;
  }

  logger.error('Runtime wiring validation failed', {
    checked: checks.length,
    issues
  });
  return result;
}

export {
  createRuntimeWiringChecks,
  describeRuntimeExport,
  validateRuntimeWiringChecks
};
