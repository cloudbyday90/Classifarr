/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildPolicyCohortSimulation,
  buildPolicyCohortSimulationDraftContract,
  buildPolicyCohortSimulationPolicy,
} from '../../services/policyCohortSimulationContract.mjs';
import { evaluateNativePolicyIntent } from '../../services/policyNativeIntentRuntimeEvaluator.mjs';

function draft() {
  return {
    schema_version: 1,
    source: 'legacy_policy_builder',
    migration_state: 'legacy_compatible',
    presets: [{
      preset_id: 3,
      preset_name: 'Comedy',
      weight: 1,
      source: 'legacy_preset',
      migration_state: 'legacy_compatible',
      signalMetadataOverrides: {},
      signalRemovalOverrides: {},
      buckets: {
        identity_signals: [{
          signal_type: 'genres',
          values: { require_any: ['Comedy'] },
          metadata: { semantics: 'identity' },
        }],
        compatibility_signals: [],
        strict_constraints: [{
          signal_type: 'certifications',
          values: { mode: 'max', max: 'PG-13' },
          metadata: { constraint_mode: 'strict' },
        }],
        boosters: [],
        exclusions: [],
        review_triggers: [],
      },
      warnings: [],
    }],
    summary: { preset_count: 1 },
  };
}

const policy = {
  id: 17,
  library_id: 23,
  library_name: 'Target Movies',
  library_media_type: 'movie',
  auto_classify_threshold: 85,
  prompt_threshold: 60,
  combination_mode: 'best_match',
};

describe('policyCohortSimulationContract', () => {
  test('adapts a validated transient draft to shared native evaluator semantics without persistence', () => {
    const contract = buildPolicyCohortSimulationDraftContract({ policy, draft: draft() });
    const simulationPolicy = buildPolicyCohortSimulationPolicy({ policy, contract });
    const evaluation = evaluateNativePolicyIntent(simulationPolicy, {
      media_type: 'movie',
      genres: ['Comedy'],
      certification: 'PG',
    });

    expect(contract.validation.valid).toBe(true);
    expect(contract.source).toBe('native_intent');
    expect(contract.purpose).toHaveLength(1);
    expect(contract.hard_limits).toHaveLength(1);
    expect(evaluation).toMatchObject({
      eligible: true,
      statusId: 'native_intent_runtime_active',
    });
    expect(simulationPolicy.policy_runtime_authority).toEqual(expect.objectContaining({
      simulationOnly: true,
      validationOk: true,
    }));
  });

  test('returns aggregate transitions without raw draft terms or historic records', () => {
    const result = buildPolicyCohortSimulation({
      context: { policy },
      sample: { windowDays: 90, maximumItems: 100, evaluatedItemCount: 2 },
      baselineOutcomes: ['eligible', 'purpose_not_matched'],
      proposedOutcomes: ['purpose_not_matched', 'eligible'],
      evaluatedAt: '2026-08-29T12:00:00.000Z',
    });

    expect(result).toMatchObject({
      version: 'policy_cohort_simulation.v1',
      sample: {
        evaluatedItemCount: 2,
        rawItemsExposed: false,
      },
      comparison: {
        transitions: {
          newlyEligible: 1,
          noLongerEligible: 1,
        },
      },
      draftRetained: false,
      rawConfigurationExposed: false,
      rawHistoricItemsExposed: false,
      routingAffected: false,
      providerAccessed: false,
      databaseWritten: false,
    });
    expect(JSON.stringify(result)).not.toContain('Comedy');
  });
});
