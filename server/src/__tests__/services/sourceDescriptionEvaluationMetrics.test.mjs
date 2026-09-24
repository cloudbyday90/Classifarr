/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createSourceDescriptionMetrics, addSourceDescriptionMetrics, finishSourceDescriptionMetrics,
  projectSourceDescriptionRanking } from '../../services/sourceDescriptionEvaluationMetrics.mjs';

const label = { libraryId: 4, kind: 'correction' };
const ranking = (overrides = {}) => ({ eligibleIds: [1, 2, 3, 4], ids: [1, 2, 3], leader: 1,
  descriptionIds: [1, 2, 3], profileIds: [1, 2, 3], ...overrides });
const scenarios = [
  ['leadingMatch', ranking({ ids: [4, 1, 2], leader: 4 })],
  ['noTrainingEvidence', ranking({ eligibleIds: [], ids: [], leader: null, descriptionIds: [], profileIds: [] })],
  ['destinationWithoutTrainingEvidence', ranking({ eligibleIds: [1, 2, 3] })],
  ['anchorShortlistDisplacement', ranking({ profileIds: [1, 2, 4] })],
  ['profileShortlistDisplacement', ranking({ descriptionIds: [1, 2, 4] })],
  ['retrievalShortlistMiss', ranking()],
  ['shortlistedNotLeading', ranking({ ids: [1, 4, 2] })],
];

test.each(scenarios)('attributes %s once in each arm, using the explicit correction only', (outcome, result) => {
  const metrics = createSourceDescriptionMetrics();
  addSourceDescriptionMetrics(metrics, result, result, label);
  for (const arm of [metrics.baseline, metrics.sourceAware]) {
    expect(arm.correctionOutcomes[outcome]).toBe(1);
    expect(Object.values(arm.correctionOutcomes).reduce((a, b) => a + b, 0)).toBe(metrics.correctionCases);
  }
  expect(metrics.correctionCases).toBe(1);
  expect(metrics.changedShortlists).toBe(0);
  expect(metrics.changedLeaders).toBe(0);
});

test('unlabeled cases count coverage only and leave empty quality denominators null', () => {
  const metrics = createSourceDescriptionMetrics();
  for (const [, result] of scenarios) addSourceDescriptionMetrics(metrics, result, result, undefined);
  finishSourceDescriptionMetrics(metrics);
  expect(metrics.cases).toBe(7);
  expect(metrics.correctionCases).toBe(0);
  for (const arm of [metrics.baseline, metrics.sourceAware]) {
    expect(arm.noEvidence).toBe(1);
    expect(arm.candidateRecallAt3).toBeNull();
    expect(arm.leadingProposalMismatchRate).toBeNull();
    expect(Object.values(arm.correctionOutcomes).every(count => count === 0)).toBe(true);
  }
});

test('outcomes partition all labels while proposal mismatch excludes absent proposals', () => {
  const metrics = createSourceDescriptionMetrics();
  for (const [, result] of scenarios) addSourceDescriptionMetrics(metrics, result, result, label);
  finishSourceDescriptionMetrics(metrics);
  for (const arm of [metrics.baseline, metrics.sourceAware]) {
    expect(Object.values(arm.correctionOutcomes).every(count => count === 1)).toBe(true);
    expect(arm.labeledProposals).toBe(6);
    expect(arm.candidateHits).toBe(2);
    expect(arm.candidateRecallAt3).toBe(0.285714);
    expect(arm.leadingProposalMismatchRate).toBe(0.833333);
  }
});

test('paired gains and regressions retain direction; strata accumulators are independent', () => {
  const metrics = createSourceDescriptionMetrics(), untouched = createSourceDescriptionMetrics();
  addSourceDescriptionMetrics(metrics, scenarios[5][1], scenarios[0][1], label);
  expect(metrics).toMatchObject({ candidateGains: 1, candidateRegressions: 0, leadingGains: 1, leadingRegressions: 0 });
  addSourceDescriptionMetrics(metrics, scenarios[0][1], scenarios[5][1], label);
  expect(metrics).toMatchObject({ candidateGains: 1, candidateRegressions: 1, leadingGains: 1, leadingRegressions: 1 });
  expect(untouched).toEqual(createSourceDescriptionMetrics());
});

test('projection ignores prompt rotation and strips private content without mutating the scorer', () => {
  const candidates = [1, 2, 3, 4].map(id => ({ id, eligible: id === 2 ? 0 : 3, name: 'PRIVATE', items: ['PRIVATE'] }));
  const entry = { candidates: [candidates[2], candidates[0], candidates[1]], investigationCandidates: candidates,
    descriptionOnlyCandidateIds: [2, 3, 4], unprotectedCandidateIds: [2, 4, 1], overview: 'PRIVATE' };
  const original = structuredClone(entry);
  expect(projectSourceDescriptionRanking(entry)).toEqual({ ids: [3, 1], eligibleIds: [1, 3, 4], leader: 1,
    descriptionIds: [3, 4], profileIds: [4, 1] });
  expect(entry).toEqual(original);
  expect(JSON.stringify(projectSourceDescriptionRanking(entry))).not.toContain('PRIVATE');
});

test('an evidence-backed candidate outside the final shortlist cannot become the reported leader', () => {
  const candidates = [1, 2, 3, 4].map(id => ({ id, eligible: id === 4 ? 1 : 0 }));
  const result = projectSourceDescriptionRanking({ candidates: candidates.slice(0, 3), investigationCandidates: candidates,
    descriptionOnlyCandidateIds: [4, 1, 2], unprotectedCandidateIds: [4, 1, 2] });
  expect(result.leader).toBeNull();
  const metrics = createSourceDescriptionMetrics();
  addSourceDescriptionMetrics(metrics, result, result, label);
  expect(metrics.baseline).toMatchObject({ noEvidence: 1, leadingMatches: 0,
    correctionOutcomes: { anchorShortlistDisplacement: 1, noTrainingEvidence: 0 } });
});

test('rotated shortlists compare as sets and a rescued destination is not counted as displaced', () => {
  const metrics = createSourceDescriptionMetrics();
  const baseline = ranking({ ids: [1, 2, 4], profileIds: [1, 2, 3] });
  addSourceDescriptionMetrics(metrics, baseline, { ...baseline, ids: [4, 1, 2] }, label);
  expect(metrics.changedShortlists).toBe(0);
  expect(metrics.baseline.correctionOutcomes.shortlistedNotLeading).toBe(1);
  expect(metrics.baseline.correctionOutcomes.profileShortlistDisplacement).toBe(0);
});
