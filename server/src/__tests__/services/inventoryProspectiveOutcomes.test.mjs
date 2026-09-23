/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluateInventoryProspectiveOutcomes } from '../../services/inventoryProspectiveOutcomes.mjs';
import { inventoryRankingShadowFixture } from '../fixtures/inventoryRankingShadowFixture.mjs';

function row(type = 'movie') {
  const { capture } = inventoryRankingShadowFixture(type);
  return { classification_id: 1, tmdb_id: 123, media_type: type, capture,
    recorded_at: capture.capturedAt, outcomes: [{ library_id: 2, was_correction: true, observed_at: capture.capturedAt }] };
}

test('scores frozen paired ranks against later exact-event corrections, not placement', () => {
  const report = evaluateInventoryProspectiveOutcomes([row()]);
  expect(report).toMatchObject({ status: 'diagnostic_only', sampleSize: 1, promotionAllowed: false,
    media: { movie: { sampled: 1, corrections: 1, companyObserved: 1, baselineMatches: 0, combinedMatches: 1, gains: 1 } },
    evidenceState: { phase: 'diagnostic_only', missing: ['tv_outcomes'] } });
  expect(JSON.stringify(report)).not.toMatch(/queryHash|snapshotId|libraryId|tmdb_id|Private/);
});

test('reports confirmation regressions separately from correction gains', () => {
  const input = row('tv'); input.outcomes[0] = { ...input.outcomes[0], library_id: 1, was_correction: false };
  const report = evaluateInventoryProspectiveOutcomes([input]);
  expect(report.kinds.confirmation).toMatchObject({ sampled: 1, confirmations: 1, baselineMatches: 1, combinedMatches: 0, regressions: 1 });
  expect(report.evidenceState).toEqual({ phase: 'diagnostic_only',
    missing: ['movie_outcomes', 'correction_outcomes', 'company_observed_corrections'] });
});

test('explains the automatic evidence lifecycle without changing promotion authority', () => {
  const empty = evaluateInventoryProspectiveOutcomes([]);
  expect(empty.evidenceState).toEqual({ phase: 'awaiting_live_comparisons', missing: ['complete_live_comparisons'] });
  const pending = row(); pending.outcomes = [];
  expect(evaluateInventoryProspectiveOutcomes([pending]).evidenceState).toEqual({
    phase: 'awaiting_operator_outcomes', missing: ['exact_event_outcomes'],
  });
  const excluded = row(); excluded.outcomes[0].library_id = 99;
  expect(evaluateInventoryProspectiveOutcomes([excluded]).evidenceState).toEqual({
    phase: 'no_eligible_outcomes', missing: ['eligible_exact_event_outcomes'],
  });
  const noCompany = structuredClone(row());
  noCompany.capture.companyAvailable = false;
  noCompany.capture.candidates.forEach(candidate => { candidate.companyFit = null; });
  noCompany.capture.combinedLibraryId = noCompany.capture.baselineLibraryId;
  expect(evaluateInventoryProspectiveOutcomes([noCompany]).evidenceState).toEqual({
    phase: 'diagnostic_only', missing: ['tv_outcomes', 'company_observed_corrections'],
  });
  for (const report of [empty, evaluateInventoryProspectiveOutcomes([pending]),
    evaluateInventoryProspectiveOutcomes([excluded]), evaluateInventoryProspectiveOutcomes([noCompany])]) {
    expect(report.promotionAllowed).toBe(false);
    expect(report.routingChanges).toBe(0);
    expect(report.providerCalls).toBe(0);
  }
});

test('a diagnostic spanning both media still cannot authorize promotion', () => {
  const movie = row();
  const tv = structuredClone(row('tv'));
  tv.classification_id = 2;
  tv.capture.queryHash = 'b'.repeat(64);
  const report = evaluateInventoryProspectiveOutcomes([movie, tv]);
  expect(report.evidenceState).toEqual({ phase: 'diagnostic_only', missing: [] });
  expect(report.promotionAllowed).toBe(false);
  expect(report.evaluation.notFullPipelineAccuracy).toBe(true);
});

test('preserves millisecond precision from PostgreSQL Date objects', () => {
  const input = row();
  input.recorded_at = new Date(input.recorded_at);
  expect(evaluateInventoryProspectiveOutcomes([input]).sampleSize).toBe(1);
});

test.each([
  ['awaitingOutcome', input => { input.outcomes = []; }],
  ['awaitingOutcome', input => { input.outcomes[0].observed_at = '2000-01-01'; }],
  ['awaitingOutcome', input => { input.outcomes[0].observed_at = '2999-01-01'; }],
  ['conflicting', input => { input.outcomes.push({ ...input.outcomes[0], library_id: 1 }); }],
  ['outsideCandidateScope', input => { input.outcomes[0].library_id = 99; }],
  ['invalid', input => { input.capture.baselineLibraryId = 2; }],
  ['invalid', input => { input.media_type = 'tv'; }],
  ['invalid', input => { input.recorded_at = '2000-01-01'; }],
  ['invalid', input => { input.outcomes = Array(101).fill(input.outcomes[0]); }],
])('reports %s rather than assigning a correctness score', (counter, mutate) => {
  const input = structuredClone(row()); mutate(input);
  const report = evaluateInventoryProspectiveOutcomes([input]);
  expect(report.sampleSize).toBe(0);
  expect(report.coverage[counter]).toBe(1);
});

test('reserves the first observation, deduplicates feedback and identical description groups', () => {
  const first = row(); first.outcomes = [];
  const retry = { ...first, classification_id: 2, recorded_at: new Date(Date.now() + 1).toISOString(),
    outcomes: [{ library_id: 2, was_correction: true, observed_at: new Date(Date.now() + 2).toISOString() }] };
  const copy = { ...retry, classification_id: 3, tmdb_id: 456 };
  const report = evaluateInventoryProspectiveOutcomes([retry, first, copy], { now: Date.now() + 1000 });
  expect(report.coverage).toMatchObject({ awaitingOutcome: 1, duplicateIdentityOrDescription: 2 });
  expect(report.sampleSize).toBe(0);
  const labeled = row(); labeled.outcomes.push({ ...labeled.outcomes[0] });
  expect(evaluateInventoryProspectiveOutcomes([labeled]).sampleSize).toBe(1);
});

test('rejects a truncated population instead of silently presenting biased metrics', () => {
  expect(() => evaluateInventoryProspectiveOutcomes(Array(5001).fill({}))).toThrow('budget');
});

test('reports anonymous selected-library strata and fails beyond the library budget', () => {
  const input = row();
  expect(evaluateInventoryProspectiveOutcomes([input]).libraries).toEqual([
    expect.objectContaining({ stratum: 1, mediaType: 'movie', sampled: 1, gains: 1 }),
  ]);
  const rows = Array.from({ length: 65 }, (_, n) => {
    const value = structuredClone(input), destination = n + 10;
    value.classification_id = n + 1; value.tmdb_id = n + 1;
    value.capture.queryHash = n.toString(16).padStart(64, '0');
    value.capture.candidates[1].libraryId = destination;
    value.capture.combinedLibraryId = destination;
    value.outcomes[0].library_id = destination;
    return value;
  });
  expect(() => evaluateInventoryProspectiveOutcomes(rows)).toThrow('library_budget');
});
