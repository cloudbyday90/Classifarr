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
  POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_COMMAND_ID,
} from '../../services/policyNativeIntentChangePurposePreflightContract.mjs';
import {
  PolicyNativeIntentChangePurposePreflightAuthorityError,
  PolicyNativeIntentChangePurposePreflightService,
  PolicyNativeIntentChangePurposePreflightStaleRevisionError,
} from '../../services/policyNativeIntentChangePurposePreflightService.mjs';

function validCommand() {
  return {
    command_id: POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_COMMAND_ID,
    values: [{
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: ['shared-purpose-token'] },
      semantics: 'identity',
    }],
  };
}

function authoritativeContext(revision = 3) {
  return {
    policy_id: 17,
    library_id: 7,
    library_media_type: 'movie',
    authority: { authoritative: true },
    activeIntent: { intent_version: revision },
  };
}

describe('native intent purpose change preflight service', () => {
  test('compares the validated command only after deriving authoritative persisted scope and revision', async () => {
    const loadContext = jest.fn().mockResolvedValue(authoritativeContext());
    const loadOverlap = jest.fn().mockResolvedValue({
      shared_required_term_count: 1,
      overlapping_destination_count: 1,
    });
    const service = new PolicyNativeIntentChangePurposePreflightService({
      loadContext,
      loadOverlap,
      now: () => '2026-08-16T12:00:00.000Z',
    });

    const result = await service.preflight({
      dbClient: { query: jest.fn() },
      policyId: 17,
      expectedRevision: 3,
      changeCommand: validCommand(),
    });

    expect(loadContext).toHaveBeenCalledWith({ db: expect.any(Object), policyId: 17 });
    expect(loadOverlap).toHaveBeenCalledWith(expect.objectContaining({
      libraryId: 7,
      mediaType: 'movie',
      candidateTerms: [{ signalType: 'genres', termKey: 'shared-purpose-token' }],
    }));
    expect(result).toEqual(expect.objectContaining({
      expectedRevision: 3,
      currentRevision: 3,
      databaseWritten: false,
      providerAccessed: false,
      changeAuthorized: false,
    }));
  });

  test('fails closed before the overlap read when the current authority is unavailable', async () => {
    const loadOverlap = jest.fn();
    const service = new PolicyNativeIntentChangePurposePreflightService({
      loadContext: jest.fn().mockResolvedValue({
        ...authoritativeContext(),
        authority: { authoritative: false },
        activeIntent: null,
      }),
      loadOverlap,
    });

    await expect(service.preflight({
      policyId: 17,
      expectedRevision: 3,
      changeCommand: validCommand(),
    })).rejects.toBeInstanceOf(PolicyNativeIntentChangePurposePreflightAuthorityError);
    expect(loadOverlap).not.toHaveBeenCalled();
  });

  test('fails closed before the overlap read when the revision has changed', async () => {
    const loadOverlap = jest.fn();
    const service = new PolicyNativeIntentChangePurposePreflightService({
      loadContext: jest.fn().mockResolvedValue(authoritativeContext(4)),
      loadOverlap,
    });

    await expect(service.preflight({
      policyId: 17,
      expectedRevision: 3,
      changeCommand: validCommand(),
    })).rejects.toBeInstanceOf(PolicyNativeIntentChangePurposePreflightStaleRevisionError);
    expect(loadOverlap).not.toHaveBeenCalled();
  });
});
