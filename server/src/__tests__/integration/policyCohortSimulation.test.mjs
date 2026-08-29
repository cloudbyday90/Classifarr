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
  PolicyCohortSimulationService,
} = await import('../../services/policyCohortSimulationService.mjs');

function purposeDraft(term) {
  return {
    schema_version: 1,
    source: 'legacy_policy_builder',
    migration_state: 'legacy_compatible',
    presets: [{
      preset_id: 1,
      preset_name: 'Simulation Draft',
      weight: 1,
      source: 'legacy_preset',
      migration_state: 'legacy_compatible',
      signalMetadataOverrides: {},
      signalRemovalOverrides: {},
      buckets: {
        identity_signals: [{
          signal_type: 'genres',
          values: { require_any: [term] },
          metadata: { semantics: 'identity' },
        }],
        compatibility_signals: [],
        strict_constraints: [],
        boosters: [],
        exclusions: [],
        review_triggers: [],
      },
      warnings: [],
    }],
    summary: { preset_count: 1 },
  };
}

describe('Policy cohort simulation integration', () => {
  let fixture;
  let historicIds = [];

  afterAll(async () => {
    if (historicIds.length > 0) {
      await db.query('DELETE FROM classification_history WHERE id = ANY($1::bigint[])', [historicIds]);
    }
    await fixture?.cleanup();
  });

  test('compares a saved compatibility policy and a transient draft without exposing historic or draft values', async () => {
    fixture = await createPolicyEngineIntegrationFixture(db, {
      mediaServerName: 'Policy Cohort Simulation Media Server',
      libraryExternalIdPrefix: 'policy-cohort-simulation',
      libraryName: 'Policy Cohort Simulation Library',
      policyName: 'Policy Cohort Simulation Policy',
      presetKeyPrefix: 'policy-cohort-simulation',
      presetName: 'Policy Cohort Simulation Preset',
      presetSignals: { genres: { require_any: ['Action'] } },
    });

    const historic = await db.query(`
      INSERT INTO classification_history (
        media_type, title, library_id, method, status, created_at, genre_names, metadata
      )
      VALUES
        ('movie', 'Simulation Action Record', $1, 'policy_engine', 'completed', '2026-08-28T12:00:00.000Z', ARRAY['Action']::text[], '{}'::jsonb),
        ('movie', 'Simulation Comedy Record', $1, 'policy_engine', 'completed', '2026-08-28T11:00:00.000Z', ARRAY['Comedy']::text[], '{}'::jsonb)
      RETURNING id
    `, [fixture.libraryId]);
    historicIds = historic.rows.map(row => row.id);

    const before = await db.query(`
      SELECT
        (SELECT COUNT(*)::INTEGER FROM policy_intents) AS intent_count,
        (SELECT COUNT(*)::INTEGER FROM policy_intent_rules) AS rule_count,
        (SELECT COUNT(*)::INTEGER FROM classification_history) AS history_count
    `);

    const simulation = await new PolicyCohortSimulationService({
      db,
      now: () => new Date('2026-08-29T12:00:00.000Z'),
    }).simulate({
      policyId: fixture.policyId,
      draft: purposeDraft('Comedy'),
    });

    const after = await db.query(`
      SELECT
        (SELECT COUNT(*)::INTEGER FROM policy_intents) AS intent_count,
        (SELECT COUNT(*)::INTEGER FROM policy_intent_rules) AS rule_count,
        (SELECT COUNT(*)::INTEGER FROM classification_history) AS history_count
    `);

    expect(simulation).toMatchObject({
      advisory: true,
      draftRetained: false,
      rawConfigurationExposed: false,
      rawHistoricItemsExposed: false,
      routingAffected: false,
      providerAccessed: false,
      databaseWritten: false,
      sample: { evaluatedItemCount: 2 },
      comparison: {
        baseline: { eligible: 1 },
        proposed: { eligible: 1 },
        transitions: {
          newlyEligible: 1,
          noLongerEligible: 1,
        },
      },
    });
    expect(after.rows).toEqual(before.rows);
    expect(JSON.stringify(simulation)).not.toContain('Simulation Action Record');
    expect(JSON.stringify(simulation)).not.toContain('Simulation Comedy Record');
    expect(JSON.stringify(simulation)).not.toContain('Action');
    expect(JSON.stringify(simulation)).not.toContain('Comedy');
  });
});
