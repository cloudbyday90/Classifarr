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
  findPolicyIdentityEvidenceAdmission,
  upsertPolicyIdentityEvidenceAdmission,
} from '../../services/policyIdentityEvidenceAdmissionRepository.mjs';

function record() {
  return {
    sourceId: 'discord_pending_answer',
    sourceEventId: 'classification:42:discord:992',
    classificationId: '42',
    libraryId: '8',
    mediaType: 'movie',
    signalType: 'genres',
    evidenceKey: 'genre:animation',
    authoritySourceId: 'operator_declared_intent',
    authorityReference: 'native-intent:33:v4',
    authorityPolicyId: '18',
    authorityIntentId: '33',
    authorityIntentVersion: 4,
    authorityFingerprint: null,
    actorReference: 'operator-7',
    sourceSystem: 'policy_authorized_identity_admission',
  };
}

describe('policyIdentityEvidenceAdmissionRepository', () => {
  test('uses a parameterized append-only insert keyed by source event', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          id: 61,
          source_id: 'discord_pending_answer',
          source_event_id: 'classification:42:discord:992',
          classification_id: 42,
          library_id: 8,
          evidence_key: 'genre:animation',
          authority_source_id: 'operator_declared_intent',
        }],
      }),
    };

    const result = await upsertPolicyIdentityEvidenceAdmission({ client, record: record() });

    const [sql, values] = client.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO policy_identity_evidence_admissions');
    expect(sql).toContain('ON CONFLICT (source_id, source_event_id) DO NOTHING');
    expect(sql).not.toContain('UPDATE');
    expect(values).toEqual([
      'discord_pending_answer',
      'classification:42:discord:992',
      '42',
      '8',
      'movie',
      'genres',
      'genre:animation',
      'operator_declared_intent',
      'native-intent:33:v4',
      '18',
      '33',
      4,
      null,
      'operator-7',
      'policy_authorized_identity_admission',
    ]);
    expect(result).toEqual({
      replayed: false,
      admission: {
        id: '61',
        sourceId: 'discord_pending_answer',
        sourceEventId: 'classification:42:discord:992',
        classificationId: '42',
        libraryId: '8',
        evidenceKey: 'genre:animation',
        authoritySourceId: 'operator_declared_intent',
      },
    });
  });

  test('returns the immutable existing admission for a source-event replay', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{
          id: 61,
          source_id: 'discord_pending_answer',
          source_event_id: 'classification:42:discord:992',
          classification_id: 42,
          library_id: 8,
          evidence_key: 'genre:animation',
          authority_source_id: 'operator_declared_intent',
        }] }),
    };

    const result = await upsertPolicyIdentityEvidenceAdmission({ client, record: record() });

    expect(client.query.mock.calls[1][0]).toContain(
      'FROM policy_identity_evidence_admissions',
    );
    expect(result).toMatchObject({ replayed: true, admission: { id: '61' } });
  });

  test('requires a caller-owned transaction client', async () => {
    await expect(upsertPolicyIdentityEvidenceAdmission({ record: record() })).rejects.toThrow(
      'Identity evidence admission persistence requires a transaction client.',
    );
    await expect(findPolicyIdentityEvidenceAdmission({
      sourceId: 'discord_pending_answer',
      sourceEventId: 'classification:42:discord:992',
    })).rejects.toThrow('Identity evidence admission persistence requires a transaction client.');
  });
});
