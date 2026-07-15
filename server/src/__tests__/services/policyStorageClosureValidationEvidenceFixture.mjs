/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS,
  buildPolicyStorageClosureValidationEvidence,
} from '../../services/policyStorageClosureValidationEvidence.mjs';

function buildPolicyStorageClosureValidationCommandResults({
  overrides = {},
} = {}) {
  return POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS.map(commandSpec => ({
    checkId: commandSpec.checkId,
    exitCode: 0,
    signal: null,
    durationMs: 12,
    startedAt: '2026-07-15T12:00:00.000Z',
    finishedAt: '2026-07-15T12:00:01.000Z',
    ...overrides[commandSpec.checkId],
  }));
}

function buildPolicyStorageClosureValidationEvidenceFixture({
  commandResultOverrides = {},
  generatedAt = '2026-07-15T12:00:02.000Z',
  sideEffects = {},
} = {}) {
  return buildPolicyStorageClosureValidationEvidence({
    commandResults: buildPolicyStorageClosureValidationCommandResults({
      overrides: commandResultOverrides,
    }),
    generatedAt,
    sideEffects,
  });
}

export {
  buildPolicyStorageClosureValidationCommandResults,
  buildPolicyStorageClosureValidationEvidenceFixture,
};
