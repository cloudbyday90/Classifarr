/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluatePresetSignals } from './policyEngineSignalScoring.mjs';
import { normalizeCombinationMode } from './policyEngineUtils.mjs';

export function scoreNativeIntentRule(rule = {}, item = {}) {
  if (!rule?.signal_type) return 0;
  const values = rule.values && typeof rule.values === 'object' && !Array.isArray(rule.values) ? rule.values : {};
  return evaluatePresetSignals({
    [rule.signal_type]: { ...values,
      ...(rule.constraint_mode ? { constraint_mode: rule.constraint_mode } : {}),
      ...(rule.semantics ? { semantics: rule.semantics } : {}) },
  }, item);
}

/** Existing combination math shared by admission and declared contribution. */
export function scoreNativeIntentRules(rules, item, combinationMode) {
  const scores = (Array.isArray(rules) ? rules : []).map(rule => {
    const weight = Number(rule?.values?.weight);
    return { score: scoreNativeIntentRule(rule, item), weight: Number.isFinite(weight) && weight > 0 ? weight : 1 };
  });
  if (!scores.length) return 0;
  const mode = normalizeCombinationMode(combinationMode);
  if (mode === 'best_match') return Math.max(...scores.map(entry => entry.score));
  if (mode === 'average') return scores.reduce((total, entry) => total + entry.score, 0) / scores.length;
  if (mode === 'require_all' && scores.some(entry => entry.score <= 50)) return 0;
  const totalWeight = scores.reduce((total, entry) => total + entry.weight, 0);
  return totalWeight > 0 ? scores.reduce((total, entry) => total + entry.score * entry.weight, 0) / totalWeight : 0;
}
