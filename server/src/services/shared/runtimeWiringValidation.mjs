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

function createRuntimeWiringChecks(modules, describeExport = describeRuntimeExport) {
  const { operationController, classificationService, ragLogger } = modules;
  return [
    {
      label: 'operationController',
      expected: 'named export OperationController as a constructor function',
      validate: () => typeof operationController?.OperationController === 'function',
      actual: () => describeExport(operationController?.OperationController),
    },
    {
      label: 'classificationService',
      expected: 'classification service with withTimeout function',
      validate: () => typeof classificationService?.withTimeout === 'function',
      actual: () => describeExport(classificationService?.withTimeout),
    },
    {
      label: 'ragLogger',
      expected: 'rag logger singleton with logStageEvent function',
      validate: () => typeof ragLogger?.logStageEvent === 'function',
      actual: () => describeExport(ragLogger?.logStageEvent),
    },
  ];
}

function validateRuntimeWiringChecks({ checks, logger }) {
  const issues = [];

  for (const check of checks) {
    if (!check.validate()) {
      issues.push({
        module: check.label,
        expected: check.expected,
        actual: check.actual(),
      });
    }
  }

  const result = {
    ok: issues.length === 0,
    checked: checks.length,
    issues,
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
    issues,
  });
  return result;
}

export {
  createRuntimeWiringChecks,
  describeRuntimeExport,
  validateRuntimeWiringChecks
};
