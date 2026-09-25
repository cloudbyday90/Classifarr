/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const arm = () => ({ hits: 0, misses: 0, unavailable: 0, proposed: 0, abstained: 0, invalid: 0,
  labeledProposals: 0, correctProposals: 0, wrongProposals: 0,
  historicalLatencyMs: 0, historicalPromptTokens: 0, historicalOutputTokens: 0 });
export const createCachedAdjudicationReport = () => ({ version: 'cached_adjudication_report.v1',
  eligible: 0, selected: 0, budgetSkipped: 0, paired: 0, labeledPairs: 0,
  changedProposals: 0, deferralsReduced: 0, deferralsIncreased: 0, correctGains: 0, correctRegressions: 0,
  baseline: arm(), sourceAware: arm(),
  limits: { maximumPairs: 25, providerCalls: 0, routingWrites: 0, promotionAllowed: false,
    currentModelVerified: false, usageIsHistorical: true, fullPipelineAccuracy: null } });

export function addCachedAdjudicationPair(report, results, label) {
  const valid = result => ['proposed', 'abstained'].includes(result?.status);
  for (const [index, name] of ['baseline', 'sourceAware'].entries()) {
    const result = results[index], counts = report[name];
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
  if (!results.every(valid)) return;
  report.paired++;
  const [a, b] = results;
  report.changedProposals += Number(a.destinationId !== b.destinationId);
  report.deferralsReduced += Number(a.status === 'abstained' && b.status === 'proposed');
  report.deferralsIncreased += Number(a.status === 'proposed' && b.status === 'abstained');
  if (!label) return;
  report.labeledPairs++;
  const correct = result => result.status === 'proposed' && String(result.destinationId) === String(label.libraryId);
  report.correctGains += Number(!correct(a) && correct(b));
  report.correctRegressions += Number(correct(a) && !correct(b));
}

export function readCachedAdjudicationReport(value, sampled) {
  const template = createCachedAdjudicationReport();
  const exact = (object, shape) => object && typeof object === 'object' && !Array.isArray(object) &&
    Object.keys(object).length === Object.keys(shape).length && Object.keys(shape).every(key => Object.hasOwn(object, key));
  const count = item => Number.isSafeInteger(item) && item >= 0;
  if (!exact(value, template) || value.version !== template.version || !exact(value.limits, template.limits) ||
      Object.entries(template.limits).some(([key, expected]) => value.limits[key] !== expected)) return null;
  const { baseline, sourceAware, limits: _limits, version: _version, ...counts } = value;
  if (!Object.values(counts).every(count) || value.eligible > sampled || value.selected > 25 ||
      value.selected + value.budgetSkipped !== value.eligible || value.paired > value.selected ||
      value.labeledPairs > value.paired || value.changedProposals > value.paired ||
      value.deferralsReduced + value.deferralsIncreased > value.paired ||
      value.correctGains + value.correctRegressions > value.labeledPairs) return null;
  if (![baseline, sourceAware].every(row => exact(row, arm()) && Object.values(row).every(count) &&
      row.hits + row.misses + row.unavailable === value.selected && row.proposed + row.abstained + row.invalid === row.hits &&
      row.correctProposals + row.wrongProposals === row.labeledProposals && row.labeledProposals <= row.proposed &&
      row.historicalLatencyMs <= row.hits * 600000 && row.historicalPromptTokens <= row.hits * 8192 &&
      row.historicalOutputTokens <= row.hits * 256)) return null;
  if (value.paired > Math.min(baseline.proposed + baseline.abstained, sourceAware.proposed + sourceAware.abstained)) return null;
  return value;
}
