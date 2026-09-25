/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { policyDecisionLibraryIdentifier } from '../utils/policyDecisionAuthority.mjs';

const arm = () => ({ automatic: 0, review: 0, manual: 0, unavailable: 0, retrievalRequested: 0,
  retrievalUnavailable: 0, labeledAutomatic: 0, correctAutomatic: 0, wrongAutomatic: 0 });
export const createAutomaticPolicyMetrics = () => ({ cases: 0, paired: 0, labeledPairs: 0,
  changedActions: 0, changedDestinations: 0, deferralsReduced: 0, deferralsIncreased: 0,
  automaticGains: 0, automaticRegressions: 0, baseline: arm(), sourceAware: arm() });
const limits = Object.freeze({ scope: 'deterministic_policy_training_ablation', fullPipelineAccuracy: null,
  independentBlindLabels: 0, temporalSeparationOnly: true, providerCalls: 0, routingWrites: 0, promotionAllowed: false });

export function projectAutomaticPolicyOutcome(common, retrieval, libraries, mediaType) {
  const result = common?.policyResult, action = result?.action;
  if (!['auto_classify', 'prompt_confirm', 'prompt_select', 'manual'].includes(action)) return null;
  const destination = policyDecisionLibraryIdentifier(result.library);
  if (action === 'auto_classify' && !libraries.some(library => String(library.id) === destination &&
      library.media_type === mediaType)) return null;
  return { kind: action === 'auto_classify' ? 'automatic' : action === 'manual' ? 'manual' : 'review',
    action, destination, retrievalRequested: retrieval.requested, retrievalUnavailable: retrieval.unavailable };
}

export function addAutomaticPolicyMetrics(target, a, b, label) {
  target.cases++;
  for (const [name, value] of [['baseline', a], ['sourceAware', b]]) {
    const counts = target[name]; counts[value?.kind ?? 'unavailable']++;
    if (value?.retrievalRequested) counts.retrievalRequested++;
    if (value?.retrievalUnavailable) counts.retrievalUnavailable++;
    if (label && value?.kind === 'automatic') {
      counts.labeledAutomatic++;
      counts[value.destination === String(label.libraryId) ? 'correctAutomatic' : 'wrongAutomatic']++;
    }
  }
  if (!a || !b) return;
  target.paired++;
  target.changedActions += Number(a.action !== b.action);
  target.changedDestinations += Number(a.destination !== b.destination);
  target.deferralsReduced += Number(a.kind !== 'automatic' && b.kind === 'automatic');
  target.deferralsIncreased += Number(a.kind === 'automatic' && b.kind !== 'automatic');
  if (!label) return;
  target.labeledPairs++;
  const correct = value => value.kind === 'automatic' && value.destination === String(label.libraryId);
  target.automaticGains += Number(!correct(a) && correct(b));
  target.automaticRegressions += Number(correct(a) && !correct(b));
}

export function createAutomaticPolicyReport(status, { metrics = null, byMedia = null, correctionLabels = 0, eligibleLabels = 0 } = {}) {
  return { version: 'automatic_policy_replay.v1', status, correctionLabels, eligibleLabels, metrics, byMedia, limits: { ...limits } };
}

const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 50000;
const exact = (value, template) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === Object.keys(template).length && Object.keys(template).every(key => Object.hasOwn(value, key));
function validMetrics(value) {
  if (!exact(value, createAutomaticPolicyMetrics())) return false;
  const { baseline, sourceAware, ...counts } = value;
  if (!Object.values(counts).every(count) || value.cases > 300 || value.paired > value.cases || value.labeledPairs > value.paired ||
      ['changedActions', 'changedDestinations', 'deferralsReduced', 'deferralsIncreased'].some(key => value[key] > value.paired) ||
      value.automaticGains + value.automaticRegressions > value.labeledPairs ||
      value.deferralsReduced + value.deferralsIncreased > value.paired) return false;
  return [baseline, sourceAware].every(row => exact(row, arm()) && Object.values(row).every(count) &&
    row.automatic + row.review + row.manual + row.unavailable === value.cases &&
    row.labeledAutomatic <= row.automatic && row.correctAutomatic + row.wrongAutomatic === row.labeledAutomatic &&
    row.retrievalRequested <= value.cases - row.unavailable && row.retrievalUnavailable <= row.retrievalRequested) &&
    value.paired <= Math.min(value.cases - baseline.unavailable, value.cases - sourceAware.unavailable) &&
    value.paired >= value.cases - baseline.unavailable - sourceAware.unavailable;
}

/** Only fixed aggregate keys survive persistence; no labels, policy names or titles. */
export function readAutomaticPolicyReport(value, sampled) {
  if (!exact(value, createAutomaticPolicyReport('')) || value.version !== 'automatic_policy_replay.v1' ||
      !['complete', 'no_policies', 'cache_incomplete', 'no_eligible_cases'].includes(value.status) ||
      !count(value.correctionLabels) || !count(value.eligibleLabels) || value.eligibleLabels > value.correctionLabels ||
      !exact(value.limits, limits) || Object.entries(limits).some(([key, expected]) => value.limits[key] !== expected)) return null;
  if (value.status !== 'complete') return value.metrics === null && value.byMedia === null ? value : null;
  if (!exact(value.byMedia, { movie: 0, tv: 0 }) || ![value.metrics, ...Object.values(value.byMedia)].every(validMetrics) ||
      value.metrics.cases !== sampled || value.metrics.labeledPairs > value.eligibleLabels ||
      [value.metrics.baseline, value.metrics.sourceAware].some(row => row.labeledAutomatic > value.eligibleLabels)) return null;
  for (const key of Object.keys(createAutomaticPolicyMetrics())) {
    if (['baseline', 'sourceAware'].includes(key)) {
      if (Object.keys(arm()).some(field => value.metrics[key][field] !== value.byMedia.movie[key][field] + value.byMedia.tv[key][field])) return null;
    } else if (value.metrics[key] !== value.byMedia.movie[key] + value.byMedia.tv[key]) return null;
  }
  return value;
}
