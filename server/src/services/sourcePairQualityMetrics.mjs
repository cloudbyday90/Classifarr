/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluationArmGap } from './evaluationCoverageGaps.mjs';
import { evaluationDestination, isCompletedEvaluationOutcome } from './mixedPolicyReplayOutcome.mjs';
import { qualityTarget } from './sourcePairQualityContract.mjs';

/** Conditional binomial description, not a population or paired-difference confidence interval. */
export function qualityWilsonInterval(successes, count) {
  if (!Number.isInteger(count) || count < 0 || count > 300 || !Number.isInteger(successes) || successes < 0 || successes > count) {
    throw new Error('quality_interval_invalid');
  }
  if (!count) return null;
  const z = 1.959963984540054, p = successes / count, scale = 1 + z * z / count;
  const center = (p + z * z / (2 * count)) / scale;
  const spread = z * Math.sqrt(p * (1 - p) / count + z * z / (4 * count * count)) / scale;
  return { lower: successes === 0 ? 0 : Math.max(0, center - spread), upper: successes === count ? 1 : Math.min(1, center + spread) };
}

const arm = () => ({ correct: 0, wrong: 0, abstained: 0, correctShare: null, wrongAmongDecisions: null });
const slice = () => ({ labels: 0, paired: 0, unpaired: 0, gains: 0, regressions: 0, netCorrectShare: null, baseline: arm(), sourceAware: arm() });
const coverage = () => ({ sampled: 0, paired: 0, missingLabels: 0, conflictingLabels: 0, independent: slice(), corrections: slice(),
  baseline: { completed: 0, abstained: 0, cacheMissing: 0, blocked: 0 }, sourceAware: { completed: 0, abstained: 0, cacheMissing: 0, blocked: 0 } });
function grade(target, results, label, mediaType) {
  if (!label) return;
  target.labels++;
  if (!results.every(isCompletedEvaluationOutcome)) { target.unpaired++; return; }
  target.paired++;
  const correct = results.map(result => evaluationDestination(result) !== null && qualityTarget(mediaType, evaluationDestination(result)) === label);
  for (const [index, name] of ['baseline', 'sourceAware'].entries()) {
    target[name][results[index].status === 'abstained' ? 'abstained' : correct[index] ? 'correct' : 'wrong']++;
  }
  target.gains += Number(!correct[0] && correct[1]); target.regressions += Number(correct[0] && !correct[1]);
}
function finish(target) {
  for (const value of [target.independent, target.corrections]) {
    value.netCorrectShare = value.paired ? (value.gains - value.regressions) / value.paired : null;
    for (const name of ['baseline', 'sourceAware']) {
      const counts = value[name];
      counts.correctShare = qualityWilsonInterval(counts.correct, value.paired);
      counts.wrongAmongDecisions = qualityWilsonInterval(counts.wrong, counts.correct + counts.wrong);
    }
  }
  return target;
}

export function summarizeSourcePairQuality(cases, references) {
  const total = coverage(), byMedia = { movie: coverage(), tv: coverage() };
  for (const row of cases) {
    for (const counts of [total, byMedia[row.mediaType]]) {
      counts.sampled++; counts.paired += Number(row.results.every(isCompletedEvaluationOutcome));
      counts.conflictingLabels += Number(references.conflicts.has(row.item));
      counts.missingLabels += Number(!references.conflicts.has(row.item) && !references.labels.has(row.item));
      for (const [index, name] of ['baseline', 'sourceAware'].entries()) {
        const gap = evaluationArmGap(row.results[index]);
        counts[name][gap === 'none' ? 'completed' : gap === 'cache_missing' ? 'cacheMissing' : 'blocked']++;
        counts[name].abstained += Number(row.results[index].status === 'abstained');
      }
      grade(counts.independent, row.results, references.labels.get(row.item), row.mediaType);
      grade(counts.corrections, row.results, row.correctionTarget, row.mediaType);
    }
  }
  return { total: finish(total), byMedia: { movie: finish(byMedia.movie), tv: finish(byMedia.tv) } };
}
