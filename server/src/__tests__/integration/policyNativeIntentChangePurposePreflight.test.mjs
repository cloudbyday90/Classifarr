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
  POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_COMMAND_ID,
} from '../../services/policyNativeIntentChangePurposePreflightContract.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const {
  PolicyNativeIntentChangePurposePreflightService,
  PolicyNativeIntentChangePurposePreflightStaleRevisionError,
} = await import('../../services/policyNativeIntentChangePurposePreflightService.mjs');

async function createNativePurposeFixture({
  fixtureKey,
  libraryName,
  policyName,
  term,
  intentVersion = 1,
}) {
  const fixture = await createPolicyEngineIntegrationFixture(db, {
    mediaServerName: 'Native Purpose Change Preflight Media Server',
    libraryExternalIdPrefix: `native-purpose-change-${fixtureKey}`,
    libraryName,
    policyName,
    presetKeyPrefix: `native-purpose-change-${fixtureKey}`,
    presetName: 'Native Purpose Change Preflight Preset',
    presetSignals: {},
  });

  await db.query(`
    WITH native_intent AS (
      INSERT INTO policy_intents (
        policy_id, library_id, schema_version, intent_version,
        active, source, inference_state, review_behavior, validation_status
      )
      VALUES ($1, $2, 1, $3, TRUE, 'native_intent', 'inferred', '{}'::jsonb, 'valid')
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
      jsonb_build_object('require_any', jsonb_build_array($4::text)),
      'advisory',
      'identity',
      'native_intent',
      'inferred'
    FROM native_intent
  `, [fixture.policyId, fixture.libraryId, intentVersion, term]);

  return fixture;
}

function purposeChangeCommand(term) {
  return {
    command_id: POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_COMMAND_ID,
    values: [{
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: [term] },
      semantics: 'identity',
    }],
  };
}

describe('native intent purpose change preflight integration', () => {
  const fixtures = [];

  afterAll(async () => {
    for (const fixture of fixtures.reverse()) {
      await fixture.cleanup();
    }
  });

  test('compares a revision-bound update_purpose command without persisting or returning terms', async () => {
    const target = await createNativePurposeFixture({
      fixtureKey: 'target',
      libraryName: 'Native Purpose Change Target',
      policyName: 'Native Purpose Change Target Policy',
      term: 'target-existing-token',
      intentVersion: 3,
    });
    const other = await createNativePurposeFixture({
      fixtureKey: 'other',
      libraryName: 'Native Purpose Change Other',
      policyName: 'Native Purpose Change Other Policy',
      term: 'shared-purpose-change-token',
    });
    fixtures.push(target, other);

    const before = await db.query(`
      SELECT
        (SELECT COUNT(*)::INTEGER FROM policy_intents) AS intent_count,
        (SELECT COUNT(*)::INTEGER FROM policy_intent_rules) AS rule_count
    `);

    const preflight = await new PolicyNativeIntentChangePurposePreflightService({
      db,
      now: () => '2026-08-16T12:00:00.000Z',
    }).preflight({
      policyId: target.policyId,
      expectedRevision: 3,
      changeCommand: purposeChangeCommand('shared-purpose-change-token'),
    });

    const after = await db.query(`
      SELECT
        (SELECT COUNT(*)::INTEGER FROM policy_intents) AS intent_count,
        (SELECT COUNT(*)::INTEGER FROM policy_intent_rules) AS rule_count
    `);

    expect(preflight).toEqual(expect.objectContaining({
      commandId: 'update_purpose',
      expectedRevision: 3,
      currentRevision: 3,
      advisory: true,
      commandRetained: false,
      rawConfigurationExposed: false,
      changeAuthorized: false,
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
    expect(JSON.stringify(preflight)).not.toContain('shared-purpose-change-token');
  });

  test('rejects a stale expected revision before performing overlap evaluation', async () => {
    const target = await createNativePurposeFixture({
      fixtureKey: 'stale',
      libraryName: 'Native Purpose Change Stale Target',
      policyName: 'Native Purpose Change Stale Target Policy',
      term: 'stale-target-token',
      intentVersion: 5,
    });
    fixtures.push(target);

    await expect(new PolicyNativeIntentChangePurposePreflightService({ db }).preflight({
      policyId: target.policyId,
      expectedRevision: 4,
      changeCommand: purposeChangeCommand('stale-proposed-token'),
    })).rejects.toBeInstanceOf(PolicyNativeIntentChangePurposePreflightStaleRevisionError);
  });
});
