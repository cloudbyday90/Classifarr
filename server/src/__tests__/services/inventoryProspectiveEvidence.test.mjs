/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluateInventoryProspectiveOutcomes } from '../../services/inventoryProspectiveOutcomes.mjs';
import { validInventoryRankingShadow } from '../../services/inventoryRankingShadow.mjs';
import { LEGACY_INVENTORY_RANKING_SHADOW_VERSION } from '../../services/inventoryRankingShadowIdentity.mjs';
import { inventoryRankingShadowFixture } from '../fixtures/inventoryRankingShadowFixture.mjs';
import { authorizedEvaluationRow, authorizedEvaluationGap } from '../helpers/authorizedOutcomeEvaluationFixture.mjs';

function row(id = 1, tmdbId = 123) {
  const capture = structuredClone(inventoryRankingShadowFixture('movie', tmdbId).capture);
  capture.capturedAt = new Date(Date.now() - 60000 + id).toISOString();
  return { classification_id: id, tmdb_id: tmdbId, media_type: 'movie', capture, recorded_at: capture.capturedAt,
    outcomes: [authorizedEvaluationRow({ classification_id: id, tmdb_id: tmdbId, identity_key: capture.identityKey,
      decision_context: null, observed_at: new Date(), authorized_snapshot: {
        ...authorizedEvaluationRow().authorized_snapshot, event_key: `classification_correction:${id}` } })] };
}

test('v1 is structurally recognizable but never acquires a scorable identity or loses its earliest holdout', () => {
  const old = row(); old.capture.version = LEGACY_INVENTORY_RANKING_SHADOW_VERSION; delete old.capture.identityKey;
  old.outcomes = [];
  expect(validInventoryRankingShadow(old.capture)).toBe(false);
  expect(validInventoryRankingShadow(old.capture, { allowLegacy: true })).toBe(true);
  const retry = row(2, 456);
  const report = evaluateInventoryProspectiveOutcomes([retry, old]);
  expect(report).toMatchObject({ sampleSize: 0, coverage: { unboundCaptures: 1, duplicateIdentityOrDescription: 1 } });
});

test.each([false, true])('all transitive alias bridges are planned before grading, reversed=%s', reverse => {
  const first = row(); first.outcomes = [];
  const second = row(2, 456); second.capture.queryHash = 'b'.repeat(64);
  const bridge = row(3, 456);
  const rows = [first, second, bridge]; if (reverse) rows.reverse();
  expect(evaluateInventoryProspectiveOutcomes(rows)).toMatchObject({ sampleSize: 0,
    coverage: { awaitingOutcome: 1, duplicateIdentityOrDescription: 2 } });
});

test.each(['missing', 'unknown_kind', 'raw'])('a favorable choice cannot override %s historical uncertainty', kind => {
  const value = row();
  const evidence = kind === 'missing' ? { ...authorizedEvaluationGap(), observed_at: new Date() }
    : kind === 'raw' ? { origin: 'unverified_correction', classification_id: 1, observed_at: new Date() }
      : { origin: 'legacy_feedback', classification_id: 1, observed_at: new Date(), target_available: true,
        feedback_snapshot: { version: 'classification.feedback_outcome.v1', mediaType: 'movie', tmdbId: 123,
          selectedLibraryId: 2, decisionContext: null } };
  value.outcomes.push(evidence);
  expect(evaluateInventoryProspectiveOutcomes([value])).toMatchObject({ sampleSize: 0, coverage: { unverifiedCaptures: 1 } });
});

test('frozen identity survives history repair without transferring a source-only label', () => {
  const repaired = row(); repaired.tmdb_id = 456;
  expect(evaluateInventoryProspectiveOutcomes([repaired]).coverage.identityMismatchCaptures).toBe(1);
  const source = row(); source.outcomes[0].tmdb_id = null; source.outcomes[0].identity_key = `source:${'a'.repeat(64)}`;
  expect(evaluateInventoryProspectiveOutcomes([source])).toMatchObject({ sampleSize: 0,
    coverage: { sourceOnlyRows: 1, identityMismatchRows: 1 } });
});

test('mixed known kinds and unavailable contradictions enter neither favorable cohort', () => {
  const mixed = row();
  mixed.outcomes.push({ ...mixed.outcomes[0], was_correction: false,
    authorized_snapshot: { ...mixed.outcomes[0].authorized_snapshot, event_key: 'classification_correction:2', action_kind: 'confirmation' } });
  const report = evaluateInventoryProspectiveOutcomes([mixed]);
  expect(report).toMatchObject({ sampleSize: 0, coverage: { mixedKinds: 1 } });
  mixed.outcomes[1].selected_library_id = 1; mixed.outcomes[1].target_available = false;
  expect(evaluateInventoryProspectiveOutcomes([mixed])).toMatchObject({ sampleSize: 0,
    coverage: { conflicting: 1, unavailableOutcomeRows: 1 } });
});

test('malformed evidence and wrong-class joins fail rather than improve a partial read', () => {
  const value = row(); value.outcomes[0].authorized_snapshot.binding_valid = false;
  expect(() => evaluateInventoryProspectiveOutcomes([value])).toThrow('invalid_snapshot');
  value.outcomes = row(2).outcomes;
  expect(() => evaluateInventoryProspectiveOutcomes([value])).toThrow('invalid_evidence');
});

test('retained corrections need exact class proof and frozen identity; absent event/context remains a gap', () => {
  const value = row(); value.outcomes = [{ origin: 'retained_correction', classification_id: 1,
    event_classification_id: 1, media_type: 'movie', identity_key: 'movie:123', selected_library_id: 2,
    observed_at: new Date(), decision_context: null, target_available: true }];
  expect(evaluateInventoryProspectiveOutcomes([value]).sampleSize).toBe(1);
  value.outcomes[0].event_classification_id = null;
  expect(evaluateInventoryProspectiveOutcomes([value])).toMatchObject({ sampleSize: 0,
    coverage: { unverifiedOutcomeRows: 1, unverifiedCaptures: 1 } });
});

test.each([false, true])('overflow cannot release an earliest holdout, legacy=%s', legacy => {
  const first = row(); first.outcomes = Array(101).fill(first.outcomes[0]);
  if (legacy) { first.capture.version = LEGACY_INVENTORY_RANKING_SHADOW_VERSION; delete first.capture.identityKey; }
  expect(evaluateInventoryProspectiveOutcomes([row(2), first])).toMatchObject({ sampleSize: 0,
    coverage: { invalid: 1, duplicateIdentityOrDescription: 1 } });
});

test('BIGINT classification ties are ordered exactly, not through rounded JavaScript numbers', () => {
  const first = row(), later = row(2);
  first.classification_id = '9223372036854775806'; first.outcomes = [];
  later.classification_id = '9223372036854775807'; later.recorded_at = first.recorded_at;
  later.capture.capturedAt = first.capture.capturedAt;
  later.outcomes[0].classification_id = later.classification_id;
  later.outcomes[0].authorized_snapshot.event_key = `classification_correction:${later.classification_id}`;
  expect(evaluateInventoryProspectiveOutcomes([later, first])).toMatchObject({ sampleSize: 0,
    coverage: { awaitingOutcome: 1, duplicateIdentityOrDescription: 1 } });
});

test('overflow retains bounded frozen outcome aliases and blocks a later differently described retry', () => {
  const first = row();
  first.outcomes[0].tmdb_id = 456; first.outcomes[0].identity_key = 'movie:456';
  first.outcomes = Array(101).fill(first.outcomes[0]);
  const later = row(2, 456); later.capture.queryHash = 'b'.repeat(64);
  expect(evaluateInventoryProspectiveOutcomes([later, first])).toMatchObject({ sampleSize: 0,
    coverage: { observationOverflowCaptures: 1, duplicateIdentityOrDescription: 1 } });
  first.outcomes.push(first.outcomes[0]);
  expect(() => evaluateInventoryProspectiveOutcomes([first, later])).toThrow('budget');
});
