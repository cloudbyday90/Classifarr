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
  PolicyDestinationCompetitionPreviewService,
} = await import('../../services/policyDestinationCompetitionPreviewService.mjs');

function purposeDraft(term) {
  return {
    schema_version: 1,
    source: 'legacy_policy_builder',
    migration_state: 'legacy_compatible',
    presets: [{
      preset_id: 1,
      preset_name: 'Competition Draft',
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

describe('policy destination competition preview integration', () => {
  let targetFixture;
  let competitorFixture;
  let historicIds = [];

  afterAll(async () => {
    if (historicIds.length > 0) {
      await db.query('DELETE FROM classification_history WHERE id = ANY($1::bigint[])', [historicIds]);
    }
    await competitorFixture?.cleanup();
    await targetFixture?.cleanup();
  });

  test('returns bounded anonymous aggregate competition without writing configuration or history', async () => {
    targetFixture = await createPolicyEngineIntegrationFixture(db, {
      mediaServerName: 'Policy Destination Competition Media Server',
      libraryExternalIdPrefix: 'policy-destination-competition-target',
      libraryName: 'Policy Destination Competition Target',
      policyName: 'Policy Destination Competition Target Policy',
      presetKeyPrefix: 'policy-destination-competition-target',
      presetName: 'Policy Destination Competition Target Preset',
      presetSignals: { genres: { require_any: ['Action'] } },
    });
    competitorFixture = await createPolicyEngineIntegrationFixture(db, {
      mediaServerName: 'Policy Destination Competition Media Server',
      libraryExternalIdPrefix: 'policy-destination-competition-competitor',
      libraryName: 'Policy Destination Competition Competitor',
      policyName: 'Policy Destination Competition Competitor Policy',
      presetKeyPrefix: 'policy-destination-competition-competitor',
      presetName: 'Policy Destination Competition Competitor Preset',
      presetSignals: { genres: { require_any: ['Comedy'] } },
    });

    const historic = await db.query(`
      INSERT INTO classification_history (
        media_type, title, library_id, method, status, created_at, genre_names, metadata
      )
      VALUES
        ('movie', 'Competition Action Record', $1, 'policy_engine', 'completed', '2026-08-28T12:00:00.000Z', ARRAY['Action']::text[], '{}'::jsonb),
        ('movie', 'Competition Comedy Record', $1, 'policy_engine', 'completed', '2026-08-28T11:00:00.000Z', ARRAY['Comedy']::text[], '{}'::jsonb),
        ('movie', 'Competition Drama Record', $1, 'policy_engine', 'completed', '2026-08-28T10:00:00.000Z', ARRAY['Drama']::text[], '{}'::jsonb)
      RETURNING id
    `, [targetFixture.libraryId]);
    historicIds = historic.rows.map(row => row.id);

    const before = await db.query(`
      SELECT
        (SELECT COUNT(*)::INTEGER FROM policy_intents) AS intent_count,
        (SELECT COUNT(*)::INTEGER FROM policy_intent_rules) AS rule_count,
        (SELECT COUNT(*)::INTEGER FROM classification_history) AS history_count
    `);

    const preview = await new PolicyDestinationCompetitionPreviewService({
      db,
      now: () => new Date('2026-08-29T12:00:00.000Z'),
    }).preview({
      policyId: targetFixture.policyId,
      draft: purposeDraft('Comedy'),
    });

    const after = await db.query(`
      SELECT
        (SELECT COUNT(*)::INTEGER FROM policy_intents) AS intent_count,
        (SELECT COUNT(*)::INTEGER FROM policy_intent_rules) AS rule_count,
        (SELECT COUNT(*)::INTEGER FROM classification_history) AS history_count
    `);

    expect(preview).toMatchObject({
      advisory: true,
      draftRetained: false,
      rawConfigurationExposed: false,
      rawHistoricItemsExposed: false,
      routingAffected: false,
      providerAccessed: false,
      databaseWritten: false,
      sample: { evaluatedItemCount: 3 },
      competitors: {
        activePolicyCount: 1,
        identitiesExposed: false,
        configurationExposed: false,
      },
      proposed: { eligibleItemCount: 1 },
      competition: {
        proposedUncontestedEligibleItemCount: 0,
        proposedSharedEligibleItemCount: 1,
        competitorOnlyEligibleItemCount: 0,
        noEligibleCandidateItemCount: 2,
      },
      comparisonCoverage: {
        statusId: 'destination_competition_comparison_coverage_complete',
        comparedActiveCompetitorPolicyCount: 1,
        maximumCompetitorPolicyCount: 25,
        additionalActiveCompetitorsExcluded: false,
        exactActiveCompetitorCountExposed: false,
        competitorIdentitiesExposed: false,
        competitorConfigurationExposed: false,
        sentinelExposed: false,
      },
      sharedEligibilityExplanation: {
        statusId: 'destination_competition_shared_eligibility_explanation_available',
        categories: [{
          categoryId: 'genre_purpose',
          label: 'Genre-based declared purpose',
          configuredCompetitorPolicyCount: 1,
        }],
        proposedTermsExposed: false,
        competitorTermsExposed: false,
        competitorIdentitiesExposed: false,
        rawRulesExposed: false,
        itemOutcomesExposed: false,
      },
    });
    expect(after.rows).toEqual(before.rows);
    expect(JSON.stringify(preview)).not.toContain('Competition Action Record');
    expect(JSON.stringify(preview)).not.toContain('Competition Comedy Record');
    expect(JSON.stringify(preview)).not.toContain('Competition Drama Record');
    expect(JSON.stringify(preview)).not.toContain('Action');
    expect(JSON.stringify(preview)).not.toContain('Comedy');
  });
});
