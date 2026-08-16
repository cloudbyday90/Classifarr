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
import {
  POLICY_INTENT_DRAFT_BUCKETS,
  POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
} from '../../services/policyIntentRequestValidator.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const {
  PolicyPurposeCoveragePreflightService,
} = await import('../../services/policyPurposeCoveragePreflightService.mjs');

function purposeDraft(term) {
  return {
    schema_version: POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
    source: 'legacy_policy_builder',
    migration_state: 'legacy_compatible',
    presets: [{
      preset_id: 17,
      preset_name: 'Purpose check',
      weight: 1,
      source: 'legacy_preset',
      migration_state: 'legacy_compatible',
      buckets: {
        [POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]: [{
          bucket: POLICY_INTENT_DRAFT_BUCKETS.IDENTITY,
          signal_type: 'genres',
          values: { require_any: [term] },
          metadata: { semantics: 'identity' },
          source: 'legacy_preset',
        }],
        [POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY]: [],
        [POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS]: [],
        [POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS]: [],
        [POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS]: [],
        [POLICY_INTENT_DRAFT_BUCKETS.REVIEW_TRIGGERS]: [],
      },
      warnings: [],
    }],
    summary: { preset_count: 1 },
  };
}

async function createNativePurposeFixture({ libraryName, policyName, term }) {
  const fixture = await createPolicyEngineIntegrationFixture(db, {
    mediaServerName: 'Policy Purpose Coverage Preflight Media Server',
    libraryExternalIdPrefix: 'policy-purpose-coverage-preflight',
    libraryName,
    policyName,
    presetKeyPrefix: 'policy-purpose-coverage-preflight',
    presetName: 'Policy Purpose Coverage Preflight Preset',
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
      'genres',
      'require_any',
      jsonb_build_object('require_any', jsonb_build_array($3::text)),
      'advisory',
      'identity',
      'native_intent',
      'inferred'
    FROM native_intent
  `, [fixture.policyId, fixture.libraryId, term]);

  return fixture;
}

describe('Policy purpose coverage preflight integration', () => {
  const fixtures = [];

  afterAll(async () => {
    for (const fixture of fixtures.reverse()) {
      await fixture.cleanup();
    }
  });

  test('compares an unsaved validated draft with active native destinations without persisting or returning terms', async () => {
    const target = await createPolicyEngineIntegrationFixture(db, {
      mediaServerName: 'Policy Purpose Coverage Preflight Target Server',
      libraryExternalIdPrefix: 'policy-purpose-coverage-preflight-target',
      libraryName: 'Coverage Preflight Target',
      policyName: 'Coverage Preflight Target Policy',
      presetKeyPrefix: 'policy-purpose-coverage-preflight-target',
      presetName: 'Coverage Preflight Target Preset',
      presetSignals: {},
    });
    const other = await createNativePurposeFixture({
      libraryName: 'Coverage Preflight Other',
      policyName: 'Coverage Preflight Other Policy',
      term: 'shared-preflight-token',
    });
    fixtures.push(target, other);

    const before = await db.query(`
      SELECT
        (SELECT COUNT(*)::INTEGER FROM policy_intents) AS intent_count,
        (SELECT COUNT(*)::INTEGER FROM policy_intent_rules) AS rule_count
    `);

    const preflight = await new PolicyPurposeCoveragePreflightService({
      db,
      now: () => '2026-08-16T12:00:00.000Z',
    }).preflight({
      policyId: target.policyId,
      draft: purposeDraft('shared-preflight-token'),
    });

    const after = await db.query(`
      SELECT
        (SELECT COUNT(*)::INTEGER FROM policy_intents) AS intent_count,
        (SELECT COUNT(*)::INTEGER FROM policy_intent_rules) AS rule_count
    `);

    expect(preflight).toEqual(expect.objectContaining({
      advisory: true,
      draftRetained: false,
      rawConfigurationExposed: false,
      routingAffected: false,
      providerAccessed: false,
      databaseWritten: false,
      coverage: expect.objectContaining({
        statusId: 'broad_overlap_review_required',
        requiredTermCount: 1,
        sharedRequiredTermCount: 1,
        overlappingDestinationCount: 1,
      }),
    }));
    expect(after.rows).toEqual(before.rows);
    expect(JSON.stringify(preflight)).not.toContain('shared-preflight-token');
  });
});
