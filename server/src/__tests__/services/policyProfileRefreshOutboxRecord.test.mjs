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
  POLICY_PROFILE_REFRESH_OUTBOX_RECORD_REASON_IDS,
  buildPolicyProfileRefreshOutboxRecord,
} from '../../services/policyProfileRefreshOutboxRecord.mjs';

function refreshCommand(overrides = {}) {
  return {
    statusId: 'ready',
    ready: true,
    command: {
      sourceId: 'discord_pending_answer',
      sourceEventId: 'classification:42:discord:991',
      classificationId: '42',
      destinationLibraryId: '8',
      learningOperationId: 'write_compatibility_evidence',
      learningTierId: 'compatibility_evidence',
      candidateKey: 'studio:pixar',
      refreshReasonId: 'profile_refresh_required',
      ...overrides,
    },
  };
}

describe('policyProfileRefreshOutboxRecord', () => {
  test('creates a compact, server-derived outbox record for admitted evidence', () => {
    const result = buildPolicyProfileRefreshOutboxRecord(refreshCommand());

    expect(result).toMatchObject({
      ready: true,
      record: {
        sourceId: 'discord_pending_answer',
        sourceEventId: 'classification:42:discord:991',
        classificationId: '42',
        libraryId: '8',
        learningOperationId: 'write_compatibility_evidence',
        learningTierId: 'compatibility_evidence',
        candidateKey: 'studio:pixar',
        refreshReasonId: 'profile_refresh_required',
        sourceSystem: 'policy_authorized_profile_refresh',
      },
    });
    expect(JSON.stringify(result.record)).not.toContain('operator-7');
  });

  test('rejects a missing canonical refresh reason', () => {
    const result = buildPolicyProfileRefreshOutboxRecord(refreshCommand({
      refreshReasonId: 'untrusted_reason',
    }));

    expect(result).toMatchObject({ ready: false, record: null });
    expect(result.reasonCodes).toContain(
      POLICY_PROFILE_REFRESH_OUTBOX_RECORD_REASON_IDS.INVALID_REFRESH_REASON,
    );
  });

  test('rejects mismatched operation and learning tier pairs', () => {
    const result = buildPolicyProfileRefreshOutboxRecord(refreshCommand({
      learningOperationId: 'write_identity_evidence',
    }));

    expect(result).toMatchObject({ ready: false, record: null });
    expect(result.reasonCodes).toContain(
      POLICY_PROFILE_REFRESH_OUTBOX_RECORD_REASON_IDS.INVALID_LEARNING_OPERATION,
    );
  });
});
