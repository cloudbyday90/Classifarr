/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluationDestination, evaluationPairKind, hasEvaluationDestination } from './mixedPolicyReplayOutcome.mjs';
const arm = () => ({ automatic: 0, labeledAutomatic: 0, correctAutomatic: 0, wrongAutomatic: 0,
  hits: 0, misses: 0, unavailable: 0, proposed: 0, abstained: 0, invalid: 0,
  labeledProposals: 0, correctProposals: 0, wrongProposals: 0,
  historicalLatencyMs: 0, historicalPromptTokens: 0, historicalOutputTokens: 0 });
export const createCachedAdjudicationReport = () => ({ version: 'cached_adjudication_report.v3', selectionOffset: 0,
  eligible: 0, selected: 0, budgetSkipped: 0, paired: 0, labeledPairs: 0,
  deterministicPairs: 0, mixedPairs: 0, aiPairs: 0,
  changedDestinations: 0, deferralsReduced: 0, deferralsIncreased: 0, correctGains: 0, correctRegressions: 0,
  baseline: arm(), sourceAware: arm(),
  limits: { maximumPairs: 25, providerCalls: 0, routingWrites: 0, promotionAllowed: false,
    currentModelVerified: false, usageIsHistorical: true, fullPipelineAccuracy: null } });

export function addCachedAdjudicationPair(report, results, label) {
  const valid = result => ['proposed', 'abstained'].includes(result?.status);
  for (const [index, name] of ['baseline', 'sourceAware'].entries()) {
    const result = results[index], counts = report[name];
    if (result.status === 'automatic') {
      counts.automatic++;
      if (label) {
        counts.labeledAutomatic++;
        counts[String(result.destinationId) === String(label.libraryId) ? 'correctAutomatic' : 'wrongAutomatic']++;
      }
      continue;
    }
    if (['misses', 'unavailable'].includes(result.status)) { counts[result.status]++; continue; }
    counts.hits++;
    counts[valid(result) ? result.status : 'invalid']++;
    counts.historicalLatencyMs += result.latencyMs;
    counts.historicalPromptTokens += result.promptTokens;
    counts.historicalOutputTokens += result.outputTokens;
    if (label && result.status === 'proposed') {
      counts.labeledProposals++;
      counts[String(result.destinationId) === String(label.libraryId) ? 'correctProposals' : 'wrongProposals']++;
    }
  }
  const kind = evaluationPairKind(results);
  if (kind === 'incomplete') return;
  report.paired++;
  report[`${kind}Pairs`]++;
  const [a, b] = results;
  report.changedDestinations += Number(evaluationDestination(a) !== evaluationDestination(b));
  report.deferralsReduced += Number(a.status === 'abstained' && hasEvaluationDestination(b));
  report.deferralsIncreased += Number(hasEvaluationDestination(a) && b.status === 'abstained');
  if (!label) return;
  report.labeledPairs++;
  const correct = result => hasEvaluationDestination(result) && String(result.destinationId) === String(label.libraryId);
  report.correctGains += Number(!correct(a) && correct(b));
  report.correctRegressions += Number(correct(a) && !correct(b));
}

export function readCachedAdjudicationReport(value, sampled) {
  if (value?.version === 'cached_adjudication_report.v1') {
    if (Object.hasOwn(value, 'selectionOffset')) return null;
    return readCachedAdjudicationReport({ ...value, version: 'cached_adjudication_report.v2', selectionOffset: 0 }, sampled) ? value : null;
  }
  const template = createCachedAdjudicationReport();
  const exact = (object, shape) => object && typeof object === 'object' && !Array.isArray(object) &&
    Object.keys(object).length === Object.keys(shape).length && Object.keys(shape).every(key => Object.hasOwn(object, key));
  const count = item => Number.isSafeInteger(item) && item >= 0;
  if (value?.version === 'cached_adjudication_report.v2') {
    const { deterministicPairs: _d, mixedPairs: _m, aiPairs: _a, changedDestinations: _c, ...legacy } = template;
    const legacyArm = () => {
      const { automatic: _auto, labeledAutomatic: _label, correctAutomatic: _correct, wrongAutomatic: _wrong, ...rest } = arm();
      return rest;
    };
    if (!exact(value, { ...legacy, changedProposals: 0 }) ||
      ![value.baseline, value.sourceAware].every(row => exact(row, legacyArm()))) return null;
    const { changedProposals, ...rest } = value;
    return readCachedAdjudicationReport({ ...rest, version: template.version, changedDestinations: changedProposals,
      deterministicPairs: 0, mixedPairs: 0, aiPairs: value.paired,
      baseline: { ...arm(), ...value.baseline }, sourceAware: { ...arm(), ...value.sourceAware } }, sampled) ? value : null;
  }
  if (!exact(value, template) || value.version !== template.version || !exact(value.limits, template.limits) ||
      Object.entries(template.limits).some(([key, expected]) => value.limits[key] !== expected)) return null;
  const { baseline, sourceAware, limits: _limits, version: _version, ...counts } = value;
  if (!Object.values(counts).every(count) || value.eligible > sampled || value.selected > 25 ||
      value.selectionOffset > 299 || value.selectionOffset + value.selected > value.eligible ||
      value.selected + value.budgetSkipped !== value.eligible || value.paired > value.selected ||
      value.labeledPairs > value.paired || value.changedDestinations > value.paired ||
      value.deterministicPairs + value.mixedPairs + value.aiPairs !== value.paired ||
      value.deferralsReduced + value.deferralsIncreased > value.paired ||
      value.correctGains + value.correctRegressions > value.labeledPairs) return null;
  if (![baseline, sourceAware].every(row => exact(row, arm()) && Object.values(row).every(count) &&
      row.automatic + row.hits + row.misses + row.unavailable === value.selected && row.proposed + row.abstained + row.invalid === row.hits &&
      row.correctAutomatic + row.wrongAutomatic === row.labeledAutomatic && row.labeledAutomatic <= row.automatic &&
      row.correctProposals + row.wrongProposals === row.labeledProposals && row.labeledProposals <= row.proposed &&
      row.historicalLatencyMs <= row.hits * 600000 && row.historicalPromptTokens <= row.hits * 8192 &&
      row.historicalOutputTokens <= row.hits * 256)) return null;
  const complete = row => row.automatic + row.proposed + row.abstained;
  // A completed arm cannot be hidden in both sides of an allegedly incomplete pair.
  // x is the number of mixed pairs with an automatic baseline (the rest have an automatic source-aware arm).
  const baselineAi = baseline.proposed + baseline.abstained, sourceAwareAi = sourceAware.proposed + sourceAware.abstained;
  const minimumX = Math.max(0, value.mixedPairs - (baselineAi - value.aiPairs),
    value.mixedPairs - (sourceAware.automatic - value.deterministicPairs));
  const maximumX = Math.min(value.mixedPairs, baseline.automatic - value.deterministicPairs, sourceAwareAi - value.aiPairs);
  if (value.paired > Math.min(complete(baseline), complete(sourceAware)) ||
    value.paired < complete(baseline) + complete(sourceAware) - value.selected || minimumX > maximumX ||
    value.deterministicPairs > Math.min(baseline.automatic, sourceAware.automatic) ||
    value.aiPairs > Math.min(baselineAi, sourceAwareAi) ||
    value.deferralsReduced > Math.min(baseline.abstained, sourceAware.automatic + sourceAware.proposed) ||
    value.deferralsIncreased > Math.min(sourceAware.abstained, baseline.automatic + baseline.proposed) ||
    value.deferralsReduced + value.deferralsIncreased > value.changedDestinations ||
    value.correctGains + value.correctRegressions > value.changedDestinations) return null;
  return value;
}
