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
  upsertPolicyCompatibilityEvidence,
} from '../../services/policyCompatibilityEvidenceRepository.mjs';

function record() {
  return {
    scope: 'studio',
    mediaType: 'movie',
    libraryId: '8',
    evidenceKey: 'studio:pixar',
    evidenceData: {
      recordVersion: 'policy.compatibility_evidence_record.v1',
      bucketId: 'compatibility_evidence',
      sourceId: 'pending_item_answers',
      authoritySourceId: 'manual_outcome',
      reasonCode: 'persisted_pending_answer_requires_learning_guard',
    },
    confidence: 50,
    provenance: 'policy_confirmed',
    status: 'active',
    createdBy: 'operator-7',
    sourceClassificationId: '42',
    sourceSystem: 'policy_authorized_compatibility',
  };
}

describe('policyCompatibilityEvidenceRepository', () => {
  test('uses the related-evidence unique index as a parameterized supporting-evidence upsert', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          id: 44,
          scope: 'studio',
          media_type: 'movie',
          library_id: 8,
          evidence_key: 'studio:pixar',
          usage_count: 2,
        }],
      }),
    };

    const result = await upsertPolicyCompatibilityEvidence({
      client,
      record: record(),
    });

    const [sql, values] = client.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO classification_evidence');
    expect(sql).toContain('ON CONFLICT (scope, media_type, library_id, evidence_key)');
    expect(sql).toContain("WHERE scope IN ('genre', 'studio', 'franchise', 'certification')");
    expect(sql).toContain('usage_count = classification_evidence.usage_count + 1');
    expect(sql).toContain('GREATEST(classification_evidence.confidence, EXCLUDED.confidence)');
    expect(values).toEqual([
      'studio',
      'movie',
      '8',
      'studio:pixar',
      JSON.stringify(record().evidenceData),
      50,
      'policy_confirmed',
      'active',
      'operator-7',
      '42',
      'policy_authorized_compatibility',
    ]);
    expect(result).toEqual({
      id: '44',
      scope: 'studio',
      mediaType: 'movie',
      libraryId: '8',
      evidenceKey: 'studio:pixar',
      usageCount: 2,
    });
  });

  test('requires a caller-owned transaction client', async () => {
    await expect(upsertPolicyCompatibilityEvidence({ record: record() })).rejects.toThrow(
      'Compatibility evidence persistence requires a transaction client.',
    );
  });
});
