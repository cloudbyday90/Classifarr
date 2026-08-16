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
  POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS,
} from '../../services/policyNativeIntentPurposeChangeReadContract.mjs';
import {
  createPolicyNativeIntentPurposeChangeReadService,
} from '../../services/policyNativeIntentPurposeChangeReadService.mjs';

function activeContext(overrides = {}) {
  return {
    authority: { authoritative: true },
    activeIntent: { id: 51, intent_version: 3 },
    purposeRules: [{
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: ['Animation'] },
      constraint_mode: 'advisory',
      semantics: 'identity',
      source: 'native_intent',
      inference_state: 'inferred',
    }],
    ...overrides,
  };
}

describe('policyNativeIntentPurposeChangeReadService', () => {
  test('returns a canonical active purpose command without accepting browser authority', async () => {
    const loadContext = jest.fn().mockResolvedValue(activeContext());
    const service = createPolicyNativeIntentPurposeChangeReadService({ loadContext });

    const result = await service.getPurposeChange({
      dbClient: { query: jest.fn() },
      policyId: 17,
    });

    expect(loadContext).toHaveBeenCalledWith({
      db: expect.any(Object),
      policyId: 17,
    });
    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS.AVAILABLE,
      policyId: 17,
      revision: 3,
      authority: expect.objectContaining({ browserAuthorityAccepted: false }),
      changeCommand: expect.objectContaining({ command_id: 'update_purpose' }),
    }));
    expect(result.changeCommand.values[0].values).toEqual({ require_any: ['Animation'] });
  });

  test('does not project editable authority when native authority is absent or unavailable', async () => {
    const service = createPolicyNativeIntentPurposeChangeReadService({
      loadContext: jest.fn().mockResolvedValue(activeContext({
        authority: { authoritative: false },
        purposeRules: [],
      })),
    });

    const result = await service.getPurposeChange({
      dbClient: { query: jest.fn() },
      policyId: 17,
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS.AUTHORITY_UNAVAILABLE,
      changeCommand: null,
      authority: expect.objectContaining({ purposeChangeAllowed: false }),
    }));
  });

  test('returns a bounded unavailable response if persisted purpose data violates the shared command contract', async () => {
    const service = createPolicyNativeIntentPurposeChangeReadService({
      loadContext: jest.fn().mockResolvedValue(activeContext({
        purposeRules: [{ signal_type: 'genres', operator: 'require_any', values: { require_any: [] } }],
      })),
    });

    const result = await service.getPurposeChange({
      dbClient: { query: jest.fn() },
      policyId: 17,
    });

    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_PURPOSE_CHANGE_READ_STATUS_IDS.READ_UNAVAILABLE);
    expect(result.changeCommand).toBeNull();
  });
});
