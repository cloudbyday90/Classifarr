/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
  hasAuthoritativeNativeIntent,
  loadEnabledPolicyNativeRuntimeReadModels,
  loadPolicyNativeRuntimeCutoverVerification,
} from '../../services/policyNativeRuntimeCutoverEvidence.mjs';
import {
  POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS,
} from '../../services/policyNativeRuntimeCutoverVerification.mjs';

function policy(overrides = {}) {
  return {
    id: 14,
    library_id: 4,
    library_name: 'Animated Movies',
    library_media_type: 'movie',
    name: 'Animated Policy',
    presets: [],
    ...overrides,
  };
}

function intent(overrides = {}) {
  return {
    id: 501,
    policy_id: 14,
    library_id: 4,
    schema_version: 1,
    intent_version: 2,
    active: true,
    source: 'native_intent',
    inference_state: 'inferred',
    review_behavior: {},
    validation_status: 'valid',
    purpose_rule_count: 1,
    ...overrides,
  };
}

function createDbClient() {
  const queries = [];

  return {
    queries,
    async query(query) {
      queries.push(query);

      if (query.includes('WITH active_intent_counts')) {
        return {
          rows: [{
            policy_id: 14,
            native_intent_id: 501,
            rollback_snapshot_id: 901,
            rollback_payload_redacted: false,
            rollback_restored_at: null,
            rollback_expires_at: '2026-08-01T12:00:00.000Z',
          }],
        };
      }
      if (query.includes('FROM library_policies policy')) {
        return { rows: [policy(), policy({ id: 15, name: 'Unconverted Policy' })] };
      }
      if (query.includes('ranked_active_intents')) {
        return { rows: [intent()] };
      }
      if (query.includes('FROM policy_intent_rules')) {
        return {
          rows: [{
            intent_id: 501,
            intent_role: 'purpose',
            collection: 'purpose',
            signal_type: 'genres',
            operator: 'require_any',
            values: { require_any: ['Animation'] },
            constraint_mode: 'advisory',
            semantics: 'identity',
            source: 'native_intent',
            inference_state: 'inferred',
            sort_order: 0,
          }],
        };
      }
      if (query.includes('FROM policy_intent_template_applications')) {
        return { rows: [] };
      }
      if (query.includes('FROM policy_intent_validation_status')) {
        return { rows: [{ intent_id: 501, status: 'valid', error_count: 0, warning_count: 0 }] };
      }

      throw new Error(`Unexpected query: ${query}`);
    },
  };
}

describe('policyNativeRuntimeCutoverEvidence', () => {
  test('loads enabled policy read models and classifies native authority from current rows', async () => {
    const dbClient = createDbClient();
    const policies = await loadEnabledPolicyNativeRuntimeReadModels(dbClient);

    expect(policies).toHaveLength(2);
    expect(hasAuthoritativeNativeIntent(policies[0])).toBe(true);
    expect(hasAuthoritativeNativeIntent(policies[1])).toBe(false);
    expect(policies[0].native_intent.contract.purpose).toHaveLength(1);
    expect(dbClient.queries.some(query => query.includes('WHERE policy.enabled = TRUE')))
      .toBe(true);
    expect(dbClient.queries.some(query => query.includes('ranked_active_intents')))
      .toBe(true);
  });

  test('verifies every enabled policy from database rows without exposing policy names', async () => {
    const dbClient = createDbClient();
    const verification = await loadPolicyNativeRuntimeCutoverVerification(dbClient, {
      rollbackAvailable: false,
      legacyDeletionBlocked: false,
      supportDiagnosticsSafe: false,
      generatedAt: '2026-07-25T12:00:00.000Z',
    });

    expect(verification.statusId)
      .toBe(POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.READY_FOR_CUTOVER_MONITORING);
    expect(verification.convertedRead).toEqual(expect.objectContaining({
      assessedPolicyCount: 1,
      invalidPolicyCount: 0,
      sourceId: 'native_intent',
    }));
    expect(verification.unconvertedRead).toEqual(expect.objectContaining({
      assessedPolicyCount: 1,
      invalidPolicyCount: 0,
      sourceId: 'compatibility_bridge',
    }));
    expect(verification).toEqual(expect.objectContaining({
      rollbackAvailable: true,
      legacyDeletionBlocked: true,
      supportDiagnosticsSafe: true,
      recoveryEvidence: expect.objectContaining({
        rollbackAvailable: true,
        assessedNativePolicyCount: 1,
      }),
    }));
    expect(JSON.stringify(verification)).not.toContain('Animated Movies');
    expect(JSON.stringify(verification)).not.toContain('Animated Policy');
    expect(JSON.stringify(verification)).not.toContain('Unconverted Policy');
  });
});
