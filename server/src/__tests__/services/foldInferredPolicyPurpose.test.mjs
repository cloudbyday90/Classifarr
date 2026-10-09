/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createFoldInferredPolicyPurpose } from '../../services/foldInferredPolicyPurpose.mjs';
import { buildPolicyLibraryProfileInitialIntentContract } from '../../services/policyLibraryProfileInitialIntent.mjs';
import { evaluateNativePolicyIntent } from '../../services/policyNativeIntentRuntimeEvaluator.mjs';
import { createAutomaticPolicyReport, readAutomaticPolicyReport } from '../../services/automaticPolicyReplayReport.mjs';

function policy(mediaType = 'movie') {
  const value = { id: 1, library_id: 1, library_media_type: mediaType,
    trust_patterns: true, trust_history: true,
    policy_runtime_authority: { sourceId: 'native_intent', validationOk: true },
    libraryProfile: { item_count: 10, genre_distribution: { STORED_ONLY: 100 },
      last_generated_at: '2026-10-01T00:00:00.000Z' } };
  value.policy_intent_contract = buildPolicyLibraryProfileInitialIntentContract({ policy: value,
    now: new Date('2026-10-01T00:00:00.000Z') }).contract;
  return value;
}
const profiles = (mediaType = 'movie') => new Map([[1, { profile: { media_type: mediaType,
  item_count: 4, genre_distribution: { TRAINING_ONLY: 100 } } }]]);

test.each(['movie', 'tv'])('rebuilds %s from fold training without stored values or input mutation', mediaType => {
  const original = policy(mediaType), training = profiles(mediaType), before = structuredClone({ original, training });
  const adapter = createFoldInferredPolicyPurpose([original]);
  const [rebuilt] = adapter.forProfiles(training);
  expect(rebuilt.policy_intent_contract.purpose[0].values.require_any).toEqual(['TRAINING_ONLY']);
  expect(rebuilt.policy_intent_contract.validation.valid).toBe(true);
  expect(evaluateNativePolicyIntent(rebuilt, { media_type: mediaType, genres: ['TRAINING_ONLY'] }).eligible).toBe(true);
  expect(evaluateNativePolicyIntent(adapter.withoutTraining[0], { media_type: mediaType }).statusId).toBe('native_intent_runtime_no_purpose');
  expect(rebuilt).toMatchObject({ trust_patterns: false, trust_history: false });
  expect(adapter.forProfiles(training)).toBe(adapter.forProfiles(training));
  expect(adapter.forProfiles(profiles(mediaType))).not.toBe(adapter.forProfiles(training));
  expect({ original, training }).toEqual(before);
});

test.each(['legacy', 'authority', 'validation', 'empty', 'missing', 'mixed', 'unrecognized', 'strict', 'inferred_limit', 'inferred_avoid'])('%s purpose stays on the existing exclusion path', kind => {
  const original = policy(), contract = original.policy_intent_contract;
  if (kind === 'legacy') original.policy_runtime_authority.sourceId = 'compatibility_bridge';
  if (kind === 'authority') original.policy_runtime_authority.validationOk = false;
  if (kind === 'validation') contract.validation.valid = false;
  if (kind === 'empty') contract.purpose = [];
  if (kind === 'missing') delete original.policy_intent_contract;
  if (kind === 'mixed') contract.purpose.push({ ...contract.purpose[0], source: 'operator_declared_intent' });
  if (kind === 'unrecognized') contract.purpose[0].signal_type = 'keywords';
  if (kind === 'strict') contract.purpose[0].constraint_mode = 'strict';
  if (kind === 'inferred_limit') contract.hard_limits = [{ ...contract.purpose[0], intent_role: 'hard_limit' }];
  if (kind === 'inferred_avoid') contract.avoid = [{ ...contract.purpose[0], intent_role: 'avoid' }];
  const adapter = createFoldInferredPolicyPurpose([original]);
  expect(adapter.forProfiles(profiles())[0]).toBe(adapter.withoutTraining[0]);
});

test.each(['missing', 'wrong_media', 'invalid_media', 'empty', 'no_genres'])('%s training cannot invent purpose', kind => {
  const training = profiles(), profile = training.get(1).profile;
  if (kind === 'missing') training.clear();
  if (kind === 'wrong_media') profile.media_type = 'tv';
  if (kind === 'invalid_media') profile.media_type = 'music';
  if (kind === 'empty') profile.item_count = 0;
  if (kind === 'no_genres') profile.genre_distribution = {};
  const adapter = createFoldInferredPolicyPurpose([policy()]);
  expect(adapter.forProfiles(training)[0]).toBe(adapter.withoutTraining[0]);
});

test('declared hard limits, hints, avoid rules and review behavior survive; inferred hints stay excluded', () => {
  const original = policy(), contract = original.policy_intent_contract;
  contract.hard_limits = [{ intent_role: 'hard_limit', signal_type: 'language', operator: 'require_any',
    values: { require_any: ['en'] }, constraint_mode: 'strict', source: 'operator_declared_intent' }];
  contract.helpful_hints = [{ intent_role: 'helpful_hint', signal_type: 'studios', operator: 'prefer',
    values: { prefer: ['Declared studio'] }, source: 'operator_declared_intent' },
  { intent_role: 'helpful_hint', signal_type: 'studios', operator: 'prefer',
    values: { prefer: ['Stored studio'] }, source: 'media_server_library_profile', inference_state: 'inferred' }];
  const [rebuilt] = createFoldInferredPolicyPurpose([original]).forProfiles(profiles());
  expect(rebuilt.policy_intent_contract).toMatchObject({ hard_limits: contract.hard_limits,
    helpful_hints: [contract.helpful_hints[0]], avoid: contract.avoid, review_behavior: contract.review_behavior });
  expect(evaluateNativePolicyIntent(rebuilt, { media_type: 'movie', genres: ['TRAINING_ONLY'], original_language: 'fr' }))
    .toMatchObject({ eligible: false, statusId: 'native_intent_runtime_hard_limit_failed' });
});

test('malformed retained contract and missing profile map fail closed', () => {
  const original = policy(); original.policy_intent_contract.hard_limits = [{ malformed: true }];
  const adapter = createFoldInferredPolicyPurpose([original]);
  expect(adapter.forProfiles(profiles())[0]).toBe(adapter.withoutTraining[0]);
  expect(() => adapter.forProfiles(null)).toThrow('fold_policy_profiles_missing');
});

test('versioned reports distinguish fold training from legacy exclusion and reject false provenance', () => {
  const report = createAutomaticPolicyReport('no_policies');
  expect(report).toMatchObject({ version: 'automatic_policy_replay.v2', limits: { inferredPurpose: 'fold_training_only', independentBlindLabels: 0 } });
  expect(readAutomaticPolicyReport(report)).toBe(report);
  const legacy = structuredClone(report); legacy.version = 'automatic_policy_replay.v1'; delete legacy.limits.inferredPurpose;
  expect(readAutomaticPolicyReport(legacy)).toBe(legacy);
  expect(readAutomaticPolicyReport({ ...report, version: 'automatic_policy_replay.v1' })).toBeNull();
  expect(readAutomaticPolicyReport({ ...report, limits: { ...report.limits, inferredPurpose: 'stored_profile' } })).toBeNull();
});
