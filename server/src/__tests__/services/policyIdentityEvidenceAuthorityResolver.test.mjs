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
  POLICY_IDENTITY_EVIDENCE_AUTHORITY_REASON_IDS,
  POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS,
  PolicyIdentityEvidenceAuthorityResolver,
} from '../../services/policyIdentityEvidenceAuthorityResolver.mjs';
import {
  listActiveDeclaredIdentityRules,
} from '../../services/policyIdentityEvidenceAuthorityRepository.mjs';

function candidate(overrides = {}) {
  return {
    evidenceKey: 'genre:animation',
    signalType: 'genre',
    ...overrides,
  };
}

function row(overrides = {}) {
  return {
    intent_id: 33,
    policy_id: 18,
    library_id: 8,
    intent_version: 4,
    signal_type: 'genres',
    operator: 'require_any',
    values: { require_any: ['Animation'] },
    ...overrides,
  };
}

describe('PolicyIdentityEvidenceAuthorityResolver', () => {
  test('verifies a matching active native purpose rule as independent declared authority', async () => {
    const repository = { listActiveDeclaredIdentityRules: jest.fn().mockResolvedValue([row()]) };
    const resolver = new PolicyIdentityEvidenceAuthorityResolver({ repository });

    const result = await resolver.resolve({
      client: { query: jest.fn() },
      libraryId: 8,
      candidate: candidate(),
    });

    expect(repository.listActiveDeclaredIdentityRules).toHaveBeenCalledWith({
      client: expect.any(Object),
      libraryId: '8',
      signalType: 'genres',
    });
    expect(result).toMatchObject({
      statusId: POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS.VERIFIED,
      ready: true,
      authority: {
        authoritySourceId: 'operator_declared_intent',
        libraryId: '8',
        evidenceKey: 'genre:animation',
        policyId: '18',
        intentId: '33',
        intentVersion: 4,
      },
    });
  });

  test('rejects an identity candidate that has no independently matching purpose rule', async () => {
    const resolver = new PolicyIdentityEvidenceAuthorityResolver({
      repository: { listActiveDeclaredIdentityRules: jest.fn().mockResolvedValue([row({
        values: { require_any: ['Comedy'] },
      })]) },
    });

    const result = await resolver.resolve({
      client: { query: jest.fn() },
      libraryId: 8,
      candidate: candidate(),
    });

    expect(result).toMatchObject({
      statusId: POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS.UNAVAILABLE,
      ready: false,
    });
    expect(result.reasonCodes).toContain(
      POLICY_IDENTITY_EVIDENCE_AUTHORITY_REASON_IDS.NO_INDEPENDENT_AUTHORITY,
    );
  });

  test('fails closed when more than one active policy independently claims the identity', async () => {
    const resolver = new PolicyIdentityEvidenceAuthorityResolver({
      repository: { listActiveDeclaredIdentityRules: jest.fn().mockResolvedValue([
        row(),
        row({ intent_id: 34, policy_id: 19, intent_version: 1 }),
      ]) },
    });

    const result = await resolver.resolve({
      client: { query: jest.fn() },
      libraryId: 8,
      candidate: candidate(),
    });

    expect(result).toMatchObject({
      statusId: POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS.AMBIGUOUS,
      ready: false,
    });
    expect(result.reasonCodes).toContain(
      POLICY_IDENTITY_EVIDENCE_AUTHORITY_REASON_IDS.AMBIGUOUS_DECLARED_AUTHORITY,
    );
  });

  test('does not admit an exclusion or unrelated value field as identity authority', async () => {
    const resolver = new PolicyIdentityEvidenceAuthorityResolver({
      repository: { listActiveDeclaredIdentityRules: jest.fn().mockResolvedValue([
        row({ operator: 'exclude', values: { exclude: ['Animation'] } }),
        row({ operator: 'require_any', values: {
          require_any: ['Comedy'],
          exclude: ['Animation'],
        } }),
      ]) },
    });

    const result = await resolver.resolve({
      client: { query: jest.fn() },
      libraryId: 8,
      candidate: candidate(),
    });

    expect(result).toMatchObject({
      statusId: POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS.UNAVAILABLE,
      ready: false,
    });
  });
});

describe('policyIdentityEvidenceAuthorityRepository', () => {
  test('reads identity authority through a caller-owned transaction lock', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [row()] }),
    };

    const result = await listActiveDeclaredIdentityRules({
      client,
      libraryId: '8',
      signalType: 'genres',
    });

    const [sql, values] = client.query.mock.calls[0];
    expect(sql).toContain('FROM policy_intents AS intent');
    expect(sql).toContain("rule.collection = 'purpose'");
    expect(sql).toContain("rule.semantics = 'identity'");
    expect(sql).toContain('rule.operator');
    expect(sql).toContain('FOR SHARE OF intent, rule');
    expect(values).toEqual(['8', 'genres']);
    expect(result).toEqual([row()]);
  });

  test('requires a caller-owned transaction client', async () => {
    await expect(listActiveDeclaredIdentityRules({
      libraryId: 8,
      signalType: 'genres',
    })).rejects.toThrow('Identity authority resolution requires a transaction client.');
  });
});
