/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { adjudicationDigest, readAdjudicationBatch } from './cachedAdjudicationContract.mjs';
import { addCachedAdjudicationPair, createCachedAdjudicationReport } from './cachedAdjudicationReport.mjs';
import { fingerprintAutomaticSourcePairInputs } from './automaticSourcePairComputation.mjs';
import { evaluationArmGap, validEvaluationGaps } from './evaluationCoverageGaps.mjs';

const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const count = value => Number.isInteger(value) && value >= 0 && value <= 300;
const flags = ['paired', 'labeled', 'gain', 'regression', 'deferralReduced', 'deferralIncreased'];
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

/** Only categories escape replay; never retain the response or destination. */
export function evaluationHistoryCase(key, mediaType, results, label) {
  const report = createCachedAdjudicationReport();
  addCachedAdjudicationPair(report, results, label);
  return { item: adjudicationDigest(key), mediaType, paired: report.paired === 1,
    labeled: report.labeledPairs === 1, gain: report.correctGains === 1,
    regression: report.correctRegressions === 1, deferralReduced: report.deferralsReduced === 1,
    deferralIncreased: report.deferralsIncreased === 1, gaps: results.map(evaluationArmGap) };
}

export function createEvaluationHistory(snapshot, result, cases) {
  const { source } = snapshot.inputs;
  const evidenceRevision = fingerprintAutomaticSourcePairInputs({ ...snapshot, inputs: { ...snapshot.inputs,
    source: { ...source, adjudicationBatch: null, adjudicationSelectionOffset: 0 } } }, result);
  const cohortRevision = adjudicationDigest([result.cohort, result.cohortCreatedAt]);
  const identity = readAdjudicationBatch(source.adjudicationBatch, source.adjudicationConfig?.fingerprint)?.identity;
  const modelRevision = adjudicationDigest(identity ? [identity.model, identity.digest, identity.contextLength] : null);
  const revision = adjudicationDigest(['evaluation_history.v2', cohortRevision, evidenceRevision, modelRevision]);
  return { version: 'evaluation_history.v2', revision, cohortRevision, evidenceRevision, modelRevision,
    sampled: result.report.sampled, eligible: result.report.aiReplay.eligible,
    offset: result.report.aiReplay.selectionOffset,
    cases: cases.map(row => ({ ...row, item: adjudicationDigest([revision, row.item]) })).sort((a, b) => a.item.localeCompare(b.item)) };
}

export function validEvaluationHistory(value, report) {
  if (!exact(value, ['version', 'revision', 'cohortRevision', 'evidenceRevision', 'modelRevision', 'sampled', 'eligible', 'offset', 'cases']) ||
    !['evaluation_history.v1', 'evaluation_history.v2'].includes(value.version) ||
    ![value.revision, value.cohortRevision, value.evidenceRevision, value.modelRevision].every(digest) ||
    value.revision !== adjudicationDigest([value.version, value.cohortRevision, value.evidenceRevision, value.modelRevision]) ||
    ![value.sampled, value.eligible, value.offset].every(count) || value.offset > 299 || value.eligible > value.sampled ||
    !Array.isArray(value.cases) || value.cases.length > 25 || value.offset + value.cases.length > value.eligible ||
    new Set(value.cases.map(row => row?.item)).size !== value.cases.length) return false;
  const gapKeys = value.version === 'evaluation_history.v2' ? ['gaps'] : [];
  if (!value.cases.every(row => exact(row, ['item', 'mediaType', ...flags, ...gapKeys]) && digest(row.item) &&
    (!gapKeys.length || validEvaluationGaps(row.gaps, row.paired)) &&
    ['movie', 'tv'].includes(row.mediaType) && flags.every(key => typeof row[key] === 'boolean') &&
    (!row.labeled || row.paired) && (!(row.gain || row.regression) || row.labeled) && !(row.gain && row.regression) &&
    (!(row.deferralReduced || row.deferralIncreased) || row.paired) && !(row.deferralReduced && row.deferralIncreased))) return false;
  if (!report) return true;
  const replay = report.aiReplay, total = key => value.cases.filter(row => row[key]).length;
  if (gapKeys.length && !['baseline', 'sourceAware'].every((arm, index) => {
    const reasons = value.cases.map(row => row.gaps[index]);
    const completed = reasons.filter(reason => reason === 'none').length;
    const missing = reasons.filter(reason => reason === 'cache_missing').length;
    const invalid = reasons.filter(reason => ['invalid_response', 'output_limited', 'context_limited'].includes(reason)).length;
    return replay?.[arm] && completed === replay[arm].proposed + replay[arm].abstained && missing === replay[arm].misses &&
      invalid === replay[arm].invalid && reasons.length - completed - missing - invalid === replay[arm].unavailable;
  })) return false;
  return !!replay && value.sampled === report.sampled && value.eligible === replay.eligible && value.offset === replay.selectionOffset &&
    value.cases.length === replay.selected && total('paired') === replay.paired && total('labeled') === replay.labeledPairs &&
    total('gain') === replay.correctGains && total('regression') === replay.correctRegressions &&
    total('deferralReduced') === replay.deferralsReduced && total('deferralIncreased') === replay.deferralsIncreased;
}
