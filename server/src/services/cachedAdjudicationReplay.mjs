/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { preparePolicyShortlistReplayCase } from './policyShortlistReplayCase.mjs';
import { reducePolicyShortlistReplayResponse } from './policyShortlistReplay.mjs';
import { adjudicationRequest, readAdjudicationBatch, ADJUDICATION_PAIR_LIMIT } from './cachedAdjudicationContract.mjs';
import { createCachedAdjudicationReport, addCachedAdjudicationPair } from './cachedAdjudicationReport.mjs';
import { automaticEvaluationOutcome } from './mixedPolicyReplayOutcome.mjs';
import { captureAdmissionCase } from './adjudicationCaptureAdmission.mjs';

/** No labels influence admission; one stable interleaved movie/TV subset, never implicit inference. */
export async function replayCachedAdjudication(outcomes, corrections, source, { onPlan, onCase, onAdmission, includeAllCases = false,
  prepare = preparePolicyShortlistReplayCase, reduce = reducePolicyShortlistReplayResponse } = {}) {
  const report = createCachedAdjudicationReport(), plan = new Map(), admission = [];
  const membership = new Map(onAdmission ? source.corpus?.documents.map(doc => [doc.key, doc.libraryIds]) ?? [] : []);
  const [baseline, sourceAware] = outcomes;
  const eligible = [...baseline].filter(([hash, a]) => {
    if (includeAllCases) return true;
    const b = sourceAware.get(hash);
    return a.outcome && b?.outcome && (a.outcome.kind !== 'automatic' || b.outcome.kind !== 'automatic' ||
      a.outcome.action !== b.outcome.action || a.outcome.destination !== b.outcome.destination);
  }).sort(([a], [b]) => a.localeCompare(b));
  const media = ['movie', 'tv'].map(type => eligible.filter(([, row]) => row.mediaType === type));
  const ordered = [];
  for (let index = 0; index < Math.max(...media.map(rows => rows.length)); index++) {
    for (const rows of media) if (rows[index]) ordered.push(rows[index]);
  }
  const offset = source.adjudicationSelectionOffset ?? 0;
  if (!Number.isInteger(offset) || offset < 0 || offset > 299) throw new Error('adjudication_selection_invalid');
  report.selectionOffset = offset < ordered.length ? offset : 0;
  const selected = ordered.slice(report.selectionOffset, report.selectionOffset + ADJUDICATION_PAIR_LIMIT);
  report.eligible = eligible.length; report.selected = selected.length; report.budgetSkipped = eligible.length - selected.length;
  const batch = readAdjudicationBatch(source.adjudicationBatch, source.adjudicationConfig?.fingerprint);
  const cache = new Map(batch?.records.map(row => [row.key, row.generated]) ?? []);
  for (const [hash, a] of selected) {
    const results = [], requestKeys = [];
    for (const row of [a, sourceAware.get(hash)]) {
      const index = results.length; requestKeys.push(null);
      const automatic = automaticEvaluationOutcome(row, source.libraries);
      if (automatic) { results.push(automatic); continue; }
      if (!source.adjudicationConfig || !row.runtime || row.common.mode !== 'adjudicate') {
        const gap = !source.adjudicationConfig ? 'configuration_unavailable'
          : !row.runtime ? 'runtime_unavailable' : 'not_adjudication';
        results.push({ status: 'unavailable', gap }); continue;
      }
      const entry = await prepare({ metadata: row.runtime.metadata, policyResult: row.common.policyResult },
        { libraries: source.libraries, config: source.adjudicationConfig.promptConfig }, row.runtime);
      const request = entry.status === 'ready' ? adjudicationRequest(entry) : null;
      if (!request) {
        const gap = ['not_adjudication', 'scope_unavailable', 'evidence_unavailable', 'evidence_changed'].includes(entry.status)
          ? entry.status : 'request_invalid';
        results.push({ status: 'unavailable', gap }); continue;
      }
      plan.set(request.key, request);
      requestKeys[index] = request.key;
      const generated = cache.get(request.key);
      results.push(generated ? reduce({ ...entry, reviewPolicies: row.policies }, 'protected', generated, batch.identity) : { status: 'misses' });
    }
    addCachedAdjudicationPair(report, results, corrections.get(a.key));
    onCase?.(a.key, a.mediaType, results, corrections.get(a.key), requestKeys);
    if (onAdmission) admission.push(captureAdmissionCase(a.key, a.mediaType, membership.get(a.key) ?? [], results, requestKeys));
  }
  onPlan?.([...plan.values()]);
  onAdmission?.(admission);
  return report;
}
