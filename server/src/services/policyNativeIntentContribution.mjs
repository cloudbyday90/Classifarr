/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { nativeIntentLiveBinding } from './policyNativeIntentLiveBinding.mjs';
import { isPolicyDeclaredNativePurposeRule } from './policyDeclaredPurposeProvenance.mjs';
import { scoreNativeIntentRule, scoreNativeIntentRules } from './policyNativeIntentRuleScoring.mjs';
import { resolvePresetSignalEvidenceMode } from './policySourceEvidenceSemantics.mjs';
import { FORMULA_CONFIDENCE_CAP } from './policyEngineUtils.mjs';
import { SIGNAL_SEMANTICS } from '../utils/policySignals.mjs';
import { evaluateNativePurposePositiveRule } from './nativePurposePositiveSemantics.mjs';

const receipts = new WeakMap();
const absent = Object.freeze({ score: 0, evidenceMode: null });

/** Native evaluator only. No public field or persisted diagnostic grants this authority. */
export function recordNativeIntentContribution(runtime, policy, item) {
  try {
    const binding = nativeIntentLiveBinding(policy, item);
    if (!binding || runtime?.eligible !== true || runtime.statusId !== 'native_intent_runtime_active') return runtime;
    const contract = policy.policy_intent_contract;
    const declared = contract.purpose.filter(isPolicyDeclaredNativePurposeRule);
    const mode = contract.review_behavior?.combination_mode || policy.combination_mode;
    const purposeScore = scoreNativeIntentRules(declared, item, mode);
    if (!(purposeScore > 50)) return runtime;
    const helpfulScore = scoreNativeIntentRules(contract.helpful_hints, item, mode);
    const helpfulBoost = helpfulScore > 50 ? Math.min(10, (helpfulScore - 50) * 0.2) : 0;
    const score = Math.max(0, Math.min(purposeScore + helpfulBoost - runtime.avoidPenalty, FORMULA_CONFIDENCE_CAP));
    if (!Number.isFinite(score)) return runtime;
    const matchedModes = declared.filter(rule => scoreNativeIntentRule(rule, item) > 50).map(rule =>
      evaluateNativePurposePositiveRule(rule, item)?.evidenceMode ??
        resolvePresetSignalEvidenceMode(rule.signal_type, { ...rule.values, ...(rule.semantics ? { semantics: rule.semantics } : {}) }));
    const evidenceMode = matchedModes.includes(SIGNAL_SEMANTICS.IDENTITY) ? SIGNAL_SEMANTICS.IDENTITY :
      matchedModes.includes(SIGNAL_SEMANTICS.COMPATIBILITY) ? SIGNAL_SEMANTICS.COMPATIBILITY : null;
    receipts.set(runtime, { binding, contribution: Object.freeze({ score, evidenceMode }) });
  } catch { /* Failure leaves the intent channel without authority; admission stays separate. */ }
  return runtime;
}

/** Exact evaluator object, current typed item and unchanged loaded contract are required. */
export function readNativeIntentContribution(runtime, policy, item) {
  const receipt = runtime && receipts.get(runtime);
  return receipt && runtime.eligible === true && runtime.statusId === 'native_intent_runtime_active' &&
    receipt.binding === nativeIntentLiveBinding(policy, item) ? receipt.contribution : absent;
}
