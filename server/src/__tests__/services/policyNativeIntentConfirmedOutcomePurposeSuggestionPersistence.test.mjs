/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  loadPolicyNativeIntentConfirmedOutcomePurposeSuggestionContext,
} from '../../services/policyNativeIntentConfirmedOutcomePurposeSuggestionPersistence.mjs';

function authoritativeIntent() {
  return {
    id: 51,
    policy_id: 17,
    library_id: 9,
    intent_version: 3,
    source: 'native_intent',
    inference_state: 'inferred',
    validation_status: 'valid',
    purpose_rule_count: 1,
  };
}

describe('policyNativeIntentConfirmedOutcomePurposeSuggestionPersistence', () => {
  test('reads only a fixed set of repeated manual-outcome genre keys after current native authority', async () => {
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{
          policy_id: 17,
          policy_name: 'Documentaries',
          library_id: 9,
          library_name: 'Documentaries',
          library_media_type: 'movie',
        }] })
        .mockResolvedValueOnce({ rows: [authoritativeIntent()] })
        .mockResolvedValueOnce({ rows: [{
          signal_type: 'genres',
          operator: 'require_any',
          values: { require_any: ['History'] },
          constraint_mode: 'advisory',
          semantics: 'identity',
          source: 'native_intent',
          inference_state: 'inferred',
        }] })
        .mockResolvedValueOnce({ rows: [{
          evidence_key: 'genre:documentary',
          confirmation_count: 3,
        }] }),
    };

    await expect(loadPolicyNativeIntentConfirmedOutcomePurposeSuggestionContext({ db, policyId: 17 }))
      .resolves.toEqual(expect.objectContaining({
        policy_id: 17,
        activeIntent: expect.objectContaining({ intent_version: 3 }),
        confirmedOutcomeGenres: [{ evidence_key: 'genre:documentary', confirmation_count: 3 }],
      }));

    const [query, params] = db.query.mock.calls[3];
    expect(params).toEqual([
      9,
      'movie',
      'policy_authorized_compatibility',
      JSON.stringify({ authoritySourceId: 'manual_outcome' }),
      2,
      5,
    ]);
    expect(query).toContain("scope = 'genre'");
    expect(query).toContain("source_system = $3");
    expect(query).toContain('evidence_data @> $4::jsonb');
    expect(query).toContain('LIMIT $6');
    expect(query).not.toContain('media_server_items');
    expect(query).not.toContain('classification_history');
    expect(query).not.toContain('evidence_data AS');
  });

  test('does not query evidence when the native authority is unavailable', async () => {
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{
          policy_id: 17,
          library_id: 9,
          library_media_type: 'movie',
        }] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    const context = await loadPolicyNativeIntentConfirmedOutcomePurposeSuggestionContext({ db, policyId: 17 });
    expect(context).toEqual(expect.objectContaining({ confirmedOutcomeGenres: [] }));
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});
