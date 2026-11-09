/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { policyEngine } from '../../services/policyEngine.mjs';
import { isComparablePolicyCandidate } from '../../services/policyInferredPurposeAdmission.mjs';

const db = createIntegrationDatabaseModuleMock();

async function withStoredPurpose(rules, mode, run) {
  const fixture = await createPolicyEngineIntegrationFixture(db, {
    libraryName: 'Synthetic provenance library', libraryExternalIdPrefix: 'native-contribution',
    policyValues: { preset_weight: 1, profile_weight: 0, pattern_weight: 0, rag_weight: 0, history_weight: 0,
      trust_patterns: false, trust_rag: false, trust_history: false },
  });
  try {
    await db.query(`WITH intent AS (
      INSERT INTO policy_intents(policy_id,library_id,schema_version,intent_version,active,source,inference_state,review_behavior,validation_status)
      VALUES ($1,$2,1,1,true,'native_intent','inferred',$3::jsonb,'valid') RETURNING id
    ), rules AS (
      INSERT INTO policy_intent_rules(intent_id,intent_role,collection,signal_type,operator,values,constraint_mode,semantics,source,inference_state)
      SELECT intent.id,'purpose','purpose','genres',r.operator,r.values,'advisory','identity',r.source,'inferred'
      FROM intent CROSS JOIN jsonb_to_recordset($4::jsonb) AS r(operator text,values jsonb,source text)
    ) INSERT INTO policy_intent_validation_status(intent_id,schema_version,status,validator_version,error_count,warning_count,errors,warnings)
      SELECT id,1,'valid','provenance-scoring-fixture',0,0,'[]'::jsonb,'[]'::jsonb FROM intent`,
    [fixture.policyId, fixture.libraryId, JSON.stringify({ combination_mode: mode, trust_patterns: false, trust_rag: false, trust_history: false }), JSON.stringify(rules)]);
    const policy = (await policyEngine.getActivePolicies()).find(row => row.id === fixture.policyId);
    expect(policy.policy_runtime_authority).toMatchObject({ sourceId: 'native_intent', statusId: 'native_intent_active', validationOk: true });
    await run(policy);
  } finally { await fixture.cleanup(); }
}

test.each(['best_match', 'average', 'weighted_average', 'require_all'])('stored mixed %s uses declared numeric support rather than its stronger profile rule', async mode => {
  await withStoredPurpose([
    { operator: 'require_any', values: { require_any: ['Animation'] }, source: 'native_intent' },
    { operator: 'require_all', values: { require_all: ['Animation'] }, source: 'media_server_library_profile' },
  ], mode, async policy => {
    const result = await policyEngine.evaluatePolicy(policy, { media_type: 'movie', tmdb_id: 42, genres: ['Animation'] });
    expect(result.native_intent_runtime.purposeScore).toBeGreaterThan(80);
    expect(result.scores).toMatchObject({ intent: 80, preset: 0 });
    expect(result.score).toBe(80);
    expect(result.candidate_diagnostics).toMatchObject({ positive_sources: { preset: 'identity' },
      purpose_evidence: { origin: 'mixed', declaredMatch: 'matched' } });
  });
});

test.each(['media_server_library_profile', 'unknown_origin'])('stored %s purpose does not become an intent contribution', async source => {
  await withStoredPurpose([{ operator: 'require_any', values: { require_any: ['Animation'] }, source }], 'best_match', async policy => {
    const result = await policyEngine.evaluatePolicy(policy, { media_type: 'movie', tmdb_id: 42, genres: ['Animation'] });
    expect(result.native_intent_runtime).toMatchObject({ eligible: true, purposeScore: 80 });
    expect(result.score).toBe(0);
    expect(result.scores.intent).toBe(0);
    expect(result.agreement).toEqual({ multiplier: 1, contributing: 0 });
    expect(result.candidate_diagnostics.positive_sources.preset).toBeNull();
    if (source === 'media_server_library_profile') expect(isComparablePolicyCandidate(result)).toBe(true);
  });
});

test('a real loaded declaration still requires an exact typed item binding for its contribution', async () => {
  await withStoredPurpose([{ operator: 'require_any', values: { require_any: ['Animation'] }, source: 'native_intent' }], 'best_match', async policy => {
    for (const tmdb_id of [undefined, '42']) {
      const result = await policyEngine.evaluatePolicy(policy, { media_type: 'movie', tmdb_id, genres: ['Animation'] });
      expect(result.native_intent_runtime.eligible).toBe(true);
      expect(result.scores.intent).toBe(0);
    }
    expect((await policyEngine.evaluatePolicy(policy, { media_type: 'movie', tmdb_id: 42, genres: ['Animation'] })).scores.intent).toBe(80);
  });
});
