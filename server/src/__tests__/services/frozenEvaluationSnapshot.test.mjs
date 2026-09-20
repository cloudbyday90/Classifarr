/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createFrozenEvaluationSnapshot, summarizeFrozenEvaluationSnapshot } from '../../services/frozenEvaluationSnapshot.mjs';

const baseline = () => ({ fingerprint: 'start', components: { documents: 'd', metadata: 'm', observedTraits: 'o', policies: 'p' } });
test('unchanged inputs and detached output cannot modify the starting digests or tracker', () => {
  const input = baseline(), tracker = createFrozenEvaluationSnapshot(input);
  input.components.metadata = 'caller mutation';
  const result = tracker.observe(baseline());
  expect(result).toMatchObject({ evaluationSnapshotValid: true, sourceVerified: true, snapshotScope: 'frozen_at_start',
    liveMetadataRefreshed: false, verificationFailure: null, changedComponents: [] });
  result.changedComponents.push('documents');
  expect(tracker.summary()).toEqual(tracker.observe(baseline()));
  expect(Object.isFrozen(tracker.sourceComponents)).toBe(true);
});

test.each(['metadata', 'observedTraits'])('%s refresh is historical, including after reversion', component => {
  const tracker = createFrozenEvaluationSnapshot(baseline()), changed = baseline();
  changed.fingerprint = 'refreshed'; changed.components[component] = 'changed';
  const result = tracker.observe(changed);
  expect(result).toMatchObject({ evaluationSnapshotValid: true, sourceVerified: false, liveMetadataRefreshed: true,
    verificationFailure: null, changedComponents: [component] });
  expect(tracker.observe(baseline())).toEqual(result);
});

test.each(['documents', 'policies', 'configuration', 'libraries', 'vectors', 'provenance', 'unknown'])('%s drift is sticky and never downgraded by metadata refresh', component => {
  const initial = baseline(); initial.components[component] = 'original';
  const tracker = createFrozenEvaluationSnapshot(initial), changed = structuredClone(initial);
  changed.fingerprint = 'changed'; changed.components[component] = 'different'; changed.components.metadata = 'enriched';
  const result = tracker.observe(changed);
  expect(result).toMatchObject({ evaluationSnapshotValid: false, sourceVerified: false, verificationFailure: 'source_changed', liveMetadataRefreshed: true });
  expect(result.changedComponents).toContain(component);
  expect(tracker.observe(initial)).toEqual(result);
});

test.each(['added', 'removed'])('%s component, even metadata, fails closed', kind => {
  const initial = baseline(), current = baseline();
  if (kind === 'added') delete initial.components.metadata;
  else delete current.components.metadata;
  current.fingerprint = 'changed';
  expect(createFrozenEvaluationSnapshot(initial).observe(current)).toMatchObject({ evaluationSnapshotValid: false,
    changedComponents: ['componentSchema', 'metadata'], verificationFailure: 'source_changed' });
});

test.each(['unexplained', 'unchanged_aggregate', 'missing'])('%s fingerprint does not bypass component verification', kind => {
  const current = baseline();
  if (kind !== 'unchanged_aggregate') current.fingerprint = kind === 'missing' ? undefined : 'unexplained';
  if (kind !== 'unexplained') current.components.metadata = 'changed';
  const result = createFrozenEvaluationSnapshot(baseline()).observe(current);
  expect(result.evaluationSnapshotValid).toBe(false);
  expect(result.changedComponents).toContain('fingerprint');
});

test.each([{ interrupted: true }, { verificationFailure: 'snapshot_verification_failed' }, { verificationFailure: 'generation_model_changed' }])('interruption/failure cannot certify metadata-only results: %j', options => {
  expect(summarizeFrozenEvaluationSnapshot({ changedComponents: ['metadata'], ...options })).toMatchObject({
    evaluationSnapshotValid: false, sourceVerified: false, liveMetadataRefreshed: true });
});

test.each([{ components: {} }, { fingerprint: '', components: { metadata: 'm' } }, { fingerprint: 'start' }])('rejects invalid starting descriptor: %j', input => {
  expect(() => createFrozenEvaluationSnapshot(input)).toThrow('frozen_evaluation_snapshot_invalid');
});
