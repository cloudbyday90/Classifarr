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
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const {
  PolicyPurposeCoverageReviewService,
} = await import('../../services/policyPurposeCoverageReviewService.mjs');

async function createNativePurposeFixture({ libraryName, policyName, purposeRules }) {
  const fixture = await createPolicyEngineIntegrationFixture(db, {
    mediaServerName: 'Policy Purpose Coverage Review Media Server',
    libraryExternalIdPrefix: 'policy-purpose-coverage-review',
    libraryName,
    policyName,
    presetKeyPrefix: 'policy-purpose-coverage-review',
    presetName: 'Policy Purpose Coverage Review Preset',
    presetSignals: {},
  });

  await db.query(`
    WITH native_intent AS (
      INSERT INTO policy_intents (
        policy_id, library_id, schema_version, intent_version,
        active, source, inference_state, review_behavior, validation_status
      )
      VALUES ($1, $2, 1, 1, TRUE, 'native_intent', 'inferred', '{}'::jsonb, 'valid')
      RETURNING id
    )
    INSERT INTO policy_intent_rules (
      intent_id, intent_role, collection, signal_type, operator,
      values, constraint_mode, semantics, source, inference_state
    )
    SELECT
      native_intent.id,
      'purpose',
      'purpose',
      purpose_rule.signal_type,
      purpose_rule.operator,
      purpose_rule.values,
      'advisory',
      'identity',
      'native_intent',
      'inferred'
    FROM native_intent
    CROSS JOIN jsonb_to_recordset($3::jsonb) AS purpose_rule(
      signal_type TEXT,
      operator TEXT,
      values JSONB
    )
  `, [fixture.policyId, fixture.libraryId, JSON.stringify(purposeRules)]);

  return fixture;
}

describe('Policy purpose coverage review integration', () => {
  const fixtures = [];

  afterAll(async () => {
    for (const fixture of fixtures.reverse()) {
      await fixture.cleanup();
    }
  });

  test('reports missing purpose coverage, shared “any” alternatives, and complete same-media-type overlap without returning configured terms', async () => {
    const maintained = await createNativePurposeFixture({
      libraryName: 'Coverage Maintained Library',
      policyName: 'Coverage Maintained Policy',
      purposeRules: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['unique-review-token'] },
      }],
    });
    const broadOne = await createNativePurposeFixture({
      libraryName: 'Coverage Broad One Library',
      policyName: 'Coverage Broad One Policy',
      purposeRules: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['shared-review-token'] },
      }],
    });
    const broadTwo = await createNativePurposeFixture({
      libraryName: 'Coverage Broad Two Library',
      policyName: 'Coverage Broad Two Policy',
      purposeRules: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['shared-review-token'] },
      }],
    });
    const mixedAny = await createNativePurposeFixture({
      libraryName: 'Coverage Mixed Any Library',
      policyName: 'Coverage Mixed Any Policy',
      purposeRules: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['shared-review-token', 'unique-mixed-review-token'] },
      }],
    });
    const missing = await createNativePurposeFixture({
      libraryName: 'Coverage Missing Library',
      policyName: 'Coverage Missing Policy',
      purposeRules: [{
        signal_type: 'media_type',
        operator: 'require_any',
        values: { require_any: ['movie'] },
      }],
    });
    fixtures.push(maintained, broadOne, broadTwo, mixedAny, missing);

    const review = await new PolicyPurposeCoverageReviewService({
      db,
      now: () => '2026-08-16T12:00:00.000Z',
    }).getReview({ limit: 100 });

    const entryByPolicyId = new Map(review.entries.map((entry) => [entry.policy.id, entry]));
    expect(entryByPolicyId.get(maintained.policyId).coverage).toEqual(expect.objectContaining({
      statusId: 'declared_specialized_coverage',
      requiredTermCount: 1,
      uniqueRequiredTermCount: 1,
      sharedRequiredTermCount: 0,
      sharedRequireAnyTermCount: 0,
    }));
    expect(entryByPolicyId.get(broadOne.policyId).coverage).toEqual(expect.objectContaining({
      statusId: 'broad_overlap_review_required',
      requiredTermCount: 1,
      uniqueRequiredTermCount: 0,
      sharedRequiredTermCount: 1,
      overlappingDestinationCount: 2,
      sharedRequireAnyTermCount: 1,
      sharedRequireAnyDestinationCount: 2,
    }));
    expect(entryByPolicyId.get(broadTwo.policyId).coverage).toEqual(expect.objectContaining({
      statusId: 'broad_overlap_review_required',
      requiredTermCount: 1,
      uniqueRequiredTermCount: 0,
      sharedRequiredTermCount: 1,
      overlappingDestinationCount: 2,
      sharedRequireAnyTermCount: 1,
      sharedRequireAnyDestinationCount: 2,
    }));
    expect(entryByPolicyId.get(mixedAny.policyId).coverage).toEqual(expect.objectContaining({
      statusId: 'broad_overlap_review_required',
      requiredTermCount: 2,
      uniqueRequiredTermCount: 1,
      sharedRequiredTermCount: 1,
      sharedRequireAnyTermCount: 1,
      sharedRequireAnyDestinationCount: 2,
    }));
    expect(entryByPolicyId.get(missing.policyId).coverage).toEqual(expect.objectContaining({
      statusId: 'missing_specialized_coverage',
      requiredTermCount: 0,
      overlappingDestinationCount: 0,
    }));
    expect(review.rawConfigurationExposed).toBe(false);
    expect(review.routingAffected).toBe(false);
    expect(JSON.stringify(review)).not.toContain('unique-review-token');
    expect(JSON.stringify(review)).not.toContain('shared-review-token');
    expect(JSON.stringify(review)).not.toContain('unique-mixed-review-token');
  });
});
