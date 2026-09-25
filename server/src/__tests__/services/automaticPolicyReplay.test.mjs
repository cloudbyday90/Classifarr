/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { sourcePairFixture, sourcePairIdentity } from '../fixtures/sourceDescriptionPairFixture.mjs';
import { runAutomaticSourcePairThread } from '../../services/automaticSourcePairThreadClient.mjs';
import { executeAutomaticSourcePair } from '../../services/automaticSourcePairExecution.mjs';
import { computeAutomaticSourcePair } from '../../services/automaticSourcePairComputation.mjs';
import { evaluateSourceDescriptionPair } from '../../services/sourceDescriptionPairedEvaluation.mjs';
import { evaluateAutomaticPolicyReplay } from '../../services/automaticPolicyReplay.mjs';
import { readAutomaticSourcePairReport } from '../../services/automaticSourcePairReport.mjs';
import { createAutomaticPolicyMetrics, addAutomaticPolicyMetrics, projectAutomaticPolicyOutcome,
  createAutomaticPolicyReport, readAutomaticPolicyReport } from '../../services/automaticPolicyReplayReport.mjs';
import { createFreshInventoryPolicyEvidence } from '../../services/freshInventoryPolicyEvidence.mjs';

function snapshot(count = 48) {
  const source = sourcePairFixture(count);
  source.evaluationRows = source.rows.map((row, index) => ({ ...row, title: `PRIVATE title ${index}`, year: 2020 }));
  source.rows = source.evaluationRows;
  source.policies = source.libraries.map(library => ({ id: library.id, library_id: library.id, enabled: true,
    name: 'PRIVATE policy', library_name: library.name, library_media_type: library.media_type,
    priority: 1, auto_classify_threshold: 85, prompt_threshold: 60, profile_weight: .5, rag_weight: .5,
    trust_rag: true, trust_patterns: false, trust_history: false, presets: [] }));
  source.policySourceRevisionRows = source.policies.map(policy => ({ policy_id: policy.id,
    media_type: policy.library_media_type, source_updated_at: '2026-09-01', mutable_attachment: false }));
  const sourceDoc = source.corpus.documents.find(doc => doc.id === null);
  source.operatorFeedbackRows = sourceDoc ? [
    { media_type: 'movie', tmdb_id: 1, selected_library_id: 2, was_correction: true, observed_at: '2026-09-20' },
    { media_type: sourceDoc.type, tmdb_id: null, identity_key: sourceDoc.key, origin: 'manual_correction',
      selected_library_id: sourceDoc.libraryIds[0], was_correction: true, observed_at: '2026-09-20' },
  ] : [];
  return { observedAt: '2026-09-25 01:00:00+00', inputs: { source, identity: sourcePairIdentity } };
}
const stateOf = result => ({ status: 'complete', report: result.report, input_fingerprint: result.fingerprint,
  cohort: result.cohort, cohort_created_at: result.cohortCreatedAt });
function prepare(source) {
  const arms = [];
  const report = evaluateSourceDescriptionPair(source, sourcePairIdentity, {}, { onPreparedArm: arm => arms.push(arm) });
  return { arms, report };
}

test('real fixed worker replays 300 movie/TV and source-only cases without exporting private evidence', async () => {
  const result = await runAutomaticSourcePairThread(snapshot(400), null);
  expect(result.report).toMatchObject({ version: 'automatic_source_pair.v2', sampled: 300,
    policyReplay: { status: 'complete', correctionLabels: 2, eligibleLabels: 2,
      metrics: { cases: 300, paired: 300, labeledPairs: 2 }, limits: { providerCalls: 0, routingWrites: 0, promotionAllowed: false } } });
  expect(readAutomaticSourcePairReport(result.report)).toBe(result.report);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|title|library_id|selected_library|sourceKey/);
  expect(Buffer.byteLength(JSON.stringify(result.report))).toBeLessThan(16384);
});

test('policy and provenance edits invalidate results while retaining the same cohort; unchanged work is reused', async () => {
  const input = snapshot(), first = await executeAutomaticSourcePair(input, null);
  expect((await executeAutomaticSourcePair(input, stateOf(first))).unchanged).toBe(true);
  input.inputs.source.policies[0].auto_classify_threshold = 90;
  const edited = await executeAutomaticSourcePair(input, stateOf(first));
  expect(edited.unchanged).toBe(false); expect(edited.fingerprint).not.toBe(first.fingerprint); expect(edited.cohort).toEqual(first.cohort);
  input.inputs.source.policySourceRevisionRows[0].source_updated_at = '2026-09-24';
  const recent = await executeAutomaticSourcePair(input, stateOf(edited));
  expect(recent.report.policyReplay.eligibleLabels).toBe(0); expect(recent.fingerprint).not.toBe(edited.fingerprint);
  const legacy = computeAutomaticSourcePair(input, null);
  expect((await executeAutomaticSourcePair(input, stateOf(legacy))).unchanged).toBe(false);
});

test.each(['cache', 'empty', 'policies'])('missing %s is explicit, and never becomes a quality success', async missing => {
  const input = snapshot(missing === 'empty' ? 0 : 48);
  if (missing === 'cache') input.inputs.source.vectors.clear();
  if (missing === 'policies') input.inputs.source.policies = [];
  const result = await executeAutomaticSourcePair(input, null);
  expect(result.report.policyReplay.status).toBe({ cache: 'cache_incomplete', empty: 'no_eligible_cases', policies: 'no_policies' }[missing]);
  expect(result.report.policyReplay.metrics).toBeNull();
  expect(readAutomaticSourcePairReport(result.report)).toBe(result.report);
});

test('both arms use production preparation without feedback labels, source membership shortcuts, or leaked training', async () => {
  const { source } = snapshot().inputs, { arms, report } = prepare(source);
  const evaluate = jest.fn(async (entry, policySource, evidence) => {
    expect(policySource.operatorFeedbackRows).toBeUndefined(); expect(policySource.policySourceRevisionRows).toBeUndefined();
    expect(policySource.policies.every(policy => !policy.trust_patterns && !policy.trust_history)).toBe(true);
    const runtime = evidence.forCase(entry);
    expect(runtime.metadata).not.toHaveProperty('library_id'); expect(runtime.metadata.title).toContain('PRIVATE');
    return { common: { policyResult: { action: 'manual', ranked: [] } } };
  });
  const result = await evaluateAutomaticPolicyReplay(source, arms, report, { evaluate });
  expect(evaluate).toHaveBeenCalledTimes(96); expect(result.metrics).toMatchObject({ paired: 48, labeledPairs: 2, baseline: { manual: 48 } });
  for (const arm of arms) {
    const evidence = createFreshInventoryPolicyEvidence({ ...arm.source, fingerprint: report.snapshotFingerprint }, arm.prepared,
      { trainingExcludedKeys: arm.trainingExcludedKeys });
    for (const entry of arm.prepared.cases) {
      const runtime = evidence.forCase(entry);
      const result = await runtime.retrieve({ contract: { valid: true, candidates: source.libraries
        .filter(library => library.media_type === entry.mediaType).map(library => ({ libraryId: library.id, mediaType: entry.mediaType })) } });
      expect(result.candidates.every(candidate => candidate.items.every(item => item.description !== entry.overview))).toBe(true);
    }
  }
});

test('missing query metadata is unavailable, not manual; mutable policy labels are not graded', async () => {
  const input = snapshot(); input.inputs.source.rows[0].title = '';
  input.inputs.source.policySourceRevisionRows.forEach(row => { row.mutable_attachment = true; });
  const result = await executeAutomaticSourcePair(input, null);
  expect(result.report.policyReplay).toMatchObject({ eligibleLabels: 0, metrics: { paired: 47, labeledPairs: 0,
    baseline: { unavailable: 1 }, sourceAware: { unavailable: 1 } } });
});

test('reducer distinguishes deferral reduction from correct automatic decisions', () => {
  const metrics = createAutomaticPolicyMetrics(), label = { libraryId: 2 };
  const manual = { kind: 'manual', action: 'manual', destination: null };
  const auto = id => ({ kind: 'automatic', action: 'auto_classify', destination: String(id) });
  addAutomaticPolicyMetrics(metrics, manual, auto(3), label);
  addAutomaticPolicyMetrics(metrics, auto(2), manual, label);
  addAutomaticPolicyMetrics(metrics, manual, auto(2), label);
  addAutomaticPolicyMetrics(metrics, null, auto(2), null);
  expect(metrics).toMatchObject({ cases: 4, paired: 3, labeledPairs: 3, deferralsReduced: 2, deferralsIncreased: 1,
    automaticGains: 1, automaticRegressions: 1, sourceAware: { wrongAutomatic: 1, correctAutomatic: 1, labeledAutomatic: 2 } });
  expect(projectAutomaticPolicyOutcome({ policyResult: { action: 'auto_classify', library: { id: 999 } } }, {}, [], 'movie')).toBeNull();
  expect(projectAutomaticPolicyOutcome({ policyResult: { action: 'unknown' } }, {}, [], 'movie')).toBeNull();
  const byMedia = { movie: structuredClone(metrics), tv: createAutomaticPolicyMetrics() };
  const report = createAutomaticPolicyReport('complete', { metrics, byMedia, eligibleLabels: 3, correctionLabels: 3 });
  expect(readAutomaticPolicyReport(report, 4)).toBe(report);
  for (const mutate of [r => { r.secret = 'PRIVATE'; }, r => { r.metrics.paired = 5; },
    r => { r.metrics.sourceAware.wrongAutomatic = 9; }, r => { r.byMedia.movie.cases++; },
    r => { r.limits.promotionAllowed = true; }, r => { r.eligibleLabels = 0; }]) {
    const invalid = structuredClone(report); mutate(invalid); expect(readAutomaticPolicyReport(invalid, 4)).toBeNull();
  }
});
