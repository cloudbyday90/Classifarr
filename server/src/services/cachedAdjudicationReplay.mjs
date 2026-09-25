/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { preparePolicyShortlistReplayCase } from './policyShortlistReplayCase.mjs';
import { reducePolicyShortlistReplayResponse } from './policyShortlistReplay.mjs';
import { adjudicationRequest, readAdjudicationBatch, ADJUDICATION_PAIR_LIMIT } from './cachedAdjudicationContract.mjs';
import { createCachedAdjudicationReport, addCachedAdjudicationPair } from './cachedAdjudicationReport.mjs';

/** No labels influence admission; one stable interleaved movie/TV subset, never implicit inference. */
export async function replayCachedAdjudication(outcomes, corrections, source, { onPlan,
  prepare = preparePolicyShortlistReplayCase, reduce = reducePolicyShortlistReplayResponse } = {}) {
  const report = createCachedAdjudicationReport(), plan = new Map();
  const [baseline, sourceAware] = outcomes;
  const eligible = [...baseline].filter(([hash, a]) => {
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
    const results = [];
    for (const row of [a, sourceAware.get(hash)]) {
      if (!row.runtime || row.common.mode !== 'adjudicate' || !source.adjudicationConfig) {
        results.push({ status: 'unavailable' }); continue;
      }
      const entry = await prepare({ metadata: row.runtime.metadata, policyResult: row.common.policyResult },
        { libraries: source.libraries, config: source.adjudicationConfig.promptConfig }, row.runtime);
      const request = entry.status === 'ready' ? adjudicationRequest(entry) : null;
      if (!request) { results.push({ status: 'unavailable' }); continue; }
      plan.set(request.key, request);
      const generated = cache.get(request.key);
      results.push(generated ? reduce({ ...entry, reviewPolicies: row.policies }, 'protected', generated, batch.identity) : { status: 'misses' });
    }
    addCachedAdjudicationPair(report, results, corrections.get(a.key));
  }
  onPlan?.([...plan.values()]);
  return report;
}
