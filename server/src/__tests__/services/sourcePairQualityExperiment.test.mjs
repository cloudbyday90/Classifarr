/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { qualitySnapshot, qualityReferences, qualityBatch } from '../fixtures/sourcePairQualityFixture.mjs';
import { prepareSourcePairQualityProtocol } from '../../services/sourcePairQualityProtocol.mjs';
import { qualityHash, qualityTarget, readQualityReferences } from '../../services/sourcePairQualityContract.mjs';
import { executeSourcePairQualityExperiment } from '../../services/sourcePairQualityExperiment.mjs';
import { qualityWilsonInterval, summarizeSourcePairQuality } from '../../services/sourcePairQualityMetrics.mjs';
import { validSourcePairQualityReport } from '../../services/sourcePairQualityReport.mjs';
import { runSourcePairQualityThread } from '../../services/sourcePairQualityRuntime.mjs';
import { runAutomaticSourcePairThread } from '../../services/automaticSourcePairThreadClient.mjs';
import { replayCachedAdjudication } from '../../services/cachedAdjudicationReplay.mjs';

test('300-case controlled experiment grades identical labeled pairs and counts shared historical requests once', async () => {
  const snapshot = qualitySnapshot(400), { source } = snapshot.inputs, key = qualityHash('synthetic request');
  source.adjudicationBatch = qualityBatch(source.adjudicationConfig.fingerprint, [{ key }]);
  const protocol = prepareSourcePairQualityProtocol(snapshot).protocol, reference = qualityReferences(protocol);
  const cases = protocol.cases.map((row, index) => {
    const destinations = source.libraries.filter(lib => lib.media_type === row.mediaType);
    const label = reference.labels[index].target;
    const correct = destinations.find(lib => qualityTarget(row.mediaType, lib.id) === label).id;
    const wrong = destinations.find(lib => lib.id !== correct).id;
    const auto = id => ({ status: 'automatic', destinationId: String(id) });
    const proposed = id => ({ status: 'proposed', destinationId: String(id) });
    const abstain = { status: 'abstained' };
    const pairs = [[auto(correct), auto(correct)], [auto(wrong), proposed(correct)], [auto(correct), abstain],
      [abstain, abstain], [proposed(wrong), auto(wrong)], [{ status: 'misses' }, proposed(correct)]];
    return { ...row, rawKey: source.corpus.documents.find(doc => qualityHash(doc.key) === row.item).key,
      results: pairs[index % 6], correction: index % 6 === 4 ? { libraryId: correct } : undefined };
  });
  reference.labels = reference.labels.filter((_, index) => index % 6 !== 4);
  const replay = jest.fn(async (_outcomes, _corrections, supplied, options) => {
    expect(options.includeAllCases).toBe(true);
    expect(supplied).not.toHaveProperty('labels');
    for (const row of cases.slice(supplied.adjudicationSelectionOffset, supplied.adjudicationSelectionOffset + 25)) {
      options.onCase(row.rawKey, row.mediaType, row.results, row.correction, [key, key]);
    }
  });
  const dependencies = { evaluateRetrieval: jest.fn(() => ({ status: 'complete' })),
    evaluatePolicy: jest.fn(async (_source, _arms, _retrieval, { onOutcomes }) => onOutcomes([], new Map())), replay };
  const result = await executeSourcePairQualityExperiment(snapshot, protocol, reference, dependencies);
  expect(result).toMatchObject({ status: 'synthetic_only', total: { sampled: 300, paired: 250, missingLabels: 50,
    independent: { labels: 250, paired: 200, unpaired: 50, gains: 50, regressions: 50, netCorrectShare: 0,
      baseline: { correct: 100, wrong: 50, abstained: 50 }, sourceAware: { correct: 100, wrong: 0, abstained: 100 } },
    corrections: { labels: 50, paired: 50, baseline: { wrong: 50 }, sourceAware: { wrong: 50 } } },
  usage: { uniqueCachedResponses: 1, historicalPromptTokens: 100, historicalOutputTokens: 10, historicalLatencyMs: 5 },
  limits: { providerCalls: 0, routingWrites: 0, promotionAllowed: false, independenceVerified: false, populationAccuracy: null } });
  expect(result.byMedia.movie.sampled + result.byMedia.tv.sampled).toBe(300);
  expect(validSourcePairQualityReport(result)).toBe(true);
  expect(replay).toHaveBeenCalledTimes(12);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|destinationId|target"|response"/);
  // Removing all reference labels changes grading only, never case selection or prediction inputs.
  const unlabeled = await executeSourcePairQualityExperiment(snapshot, protocol, null, dependencies);
  expect(unlabeled.total.paired).toBe(result.total.paired);
  expect(unlabeled.status).toBe('insufficient_reference_labels');
  expect(dependencies.evaluateRetrieval.mock.calls[0].slice(0, 3)).toEqual(dependencies.evaluateRetrieval.mock.calls[1].slice(0, 3));
  expect(validSourcePairQualityReport(unlabeled)).toBe(true);
});

test('production worker processes 300 movie/TV cases without turning cache misses into quality claims', async () => {
  const snapshot = qualitySnapshot(400);
  const protocol = await runSourcePairQualityThread(snapshot);
  const report = await runSourcePairQualityThread(snapshot, protocol);
  expect(report).toMatchObject({ status: 'insufficient_reference_labels', total: { sampled: 300, paired: 0, missingLabels: 300,
    baseline: { cacheMissing: 300 }, sourceAware: { cacheMissing: 300 } }, usage: { uniqueCachedResponses: 0 } });
  expect(validSourcePairQualityReport(report)).toBe(true);
  expect(JSON.stringify(report)).not.toContain('PRIVATE');
});

test('production cached reducer preserves abstentions, partial coverage and explicit synthetic provenance', async () => {
  const snapshot = qualitySnapshot(), source = snapshot.inputs.source;
  const capture = await runAutomaticSourcePairThread(snapshot, null, undefined, { includePlan: true });
  source.adjudicationBatch = qualityBatch(source.adjudicationConfig.fingerprint, capture.plan);
  const protocol = await runSourcePairQualityThread(snapshot);
  const report = await runSourcePairQualityThread(snapshot, protocol, qualityReferences(protocol));
  expect(report).toMatchObject({ status: 'synthetic_only', total: { sampled: 48, paired: 25,
    independent: { labels: 48, paired: 25, unpaired: 23, baseline: { abstained: 25 }, sourceAware: { abstained: 25 } } },
  usage: { uniqueCachedResponses: capture.plan.length } });
  expect(validSourcePairQualityReport(report)).toBe(true);
});

test('unchanged automatic agreements are included only for explicit full-cohort replay', async () => {
  const row = { key: 'case', mediaType: 'movie', outcome: { kind: 'automatic', action: 'auto_classify', destination: '1' },
    common: { mode: 'skip', policyResult: { action: 'auto_classify', library: { id: 1 } } } };
  const outcomes = [new Map([['hash', row]]), new Map([['hash', row]])], source = { libraries: [{ id: 1, media_type: 'movie' }] };
  expect((await replayCachedAdjudication(outcomes, new Map(), source)).selected).toBe(0);
  const onCase = jest.fn(), report = await replayCachedAdjudication(outcomes, new Map(), source, { includeAllCases: true, onCase });
  expect(report).toMatchObject({ selected: 1, paired: 1, baseline: { automatic: 1 }, sourceAware: { automatic: 1 } });
  expect(onCase.mock.calls[0][4]).toEqual([null, null]);
});

test.each(['vectors', 'policies', 'empty'])('missing %s stays explicit', async missing => {
  const snapshot = qualitySnapshot(missing === 'empty' ? 0 : 48);
  if (missing === 'vectors') snapshot.inputs.source.vectors.clear();
  if (missing === 'policies') snapshot.inputs.source.policies = [];
  const protocol = await executeSourcePairQualityExperiment(snapshot);
  const result = await executeSourcePairQualityExperiment(snapshot, protocol);
  expect(validSourcePairQualityReport(result)).toBe(true);
  expect(result.status).toBe(missing === 'empty' ? 'no_eligible_cases' : 'insufficient_reference_labels');
  expect(result.total.baseline.blocked).toBe(missing === 'empty' ? 0 : 48);
  await expect(executeSourcePairQualityExperiment(snapshot, null, {})).rejects.toThrow('quality_protocol_required');
});

test('missing/duplicate replay cases cannot silently inflate or shrink the denominator', async () => {
  const snapshot = qualitySnapshot(), protocol = prepareSourcePairQualityProtocol(snapshot).protocol;
  await expect(executeSourcePairQualityExperiment(snapshot, protocol, null, {
    evaluateRetrieval: () => ({ status: 'complete' }), evaluatePolicy: async () => {},
  })).rejects.toThrow('quality_cases_mismatch');
});

test('Wilson bounds remain finite at extremes; invalid denominators are rejected', () => {
  expect(qualityWilsonInterval(0, 0)).toBeNull();
  expect(qualityWilsonInterval(0, 100)).toMatchObject({ lower: 0, upper: expect.any(Number) });
  expect(qualityWilsonInterval(100, 100).upper).toBe(1);
  expect(qualityWilsonInterval(50, 100).lower).toBeCloseTo(.4038, 4);
  for (const args of [[-1, 1], [2, 1], [0, 301], [0, NaN], [0.5, 1]]) expect(() => qualityWilsonInterval(...args)).toThrow();
});

test('conflicts are neither missing nor graded and egress rejects private/inconsistent fields', async () => {
  const snapshot = qualitySnapshot(), protocol = prepareSourcePairQualityProtocol(snapshot).protocol, reference = qualityReferences(protocol);
  reference.labels.push({ ...reference.labels[0], target: protocol.destinations.find(row => row.mediaType === reference.labels[0].mediaType && row.target !== reference.labels[0].target).target });
  const cases = protocol.cases.map(row => ({ ...row, results: [{ status: 'abstained' }, { status: 'unavailable', gap: 'unknown' }] }));
  const result = summarizeSourcePairQuality(cases, readQualityReferences(reference, protocol));
  expect(result.total).toMatchObject({ missingLabels: 0, conflictingLabels: 1, independent: { labels: 47, paired: 0, unpaired: 47 } });
  const valid = await executeSourcePairQualityExperiment(snapshot, protocol);
  const mutations = [r => { r.private = 'PRIVATE'; }, r => { r.total.sampled++; }, r => { r.total.independent.labels++; },
    r => { r.usage.historicalOutputTokens = 1; }, r => { r.limits.providerCalls = 1; }, r => { r.status = 'measured'; },
    r => { r.byMedia.movie.baseline.completed++; }, r => { r.total.independent.baseline.correctShare = { lower: 0, upper: 1 }; }];
  for (const mutate of mutations) { const changed = structuredClone(valid); mutate(changed); expect(validSourcePairQualityReport(changed)).toBeFalsy(); }
});
