/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isTrustedLocalOllamaEndpoint } from './ollamaLocalEndpointTrust.mjs';

/** Server configuration admits evaluation; it does not itself grant routing authority. */
export function resolveLearnedEvidenceEvaluationMode(config, requireAllConfirmations = false) {
  if (config?.rag_enabled !== true || config.primary_provider !== 'ollama' ||
      !isTrustedLocalOllamaEndpoint(config.ollama_host) || typeof requireAllConfirmations !== 'boolean' ||
      !['true', 'false'].includes(config.confirmation_setting)) return null;
  return config.confirmation_setting === 'true' || requireAllConfirmations ? 'review_only' : 'automatic';
}

/** Per-service concurrency and content-free diagnostics; neither is a routing receipt. */
export function createLearnedEvidenceEvaluationControl() {
  let busy = false;
  const counts = Object.fromEntries(['prepared_admin_held', 'strict_qualified_admin_held', 'calibrated_qualified_admin_held',
    'live_guard_blocked', 'busy', 'unavailable', 'fallback_blocked', 'freshness_blocked', 'qualified'].map(reason => [reason, 0]));
  const record = reason => { if (Object.hasOwn(counts, reason)) counts[reason] = Math.min(1_000_000, counts[reason] + 1); };
  return Object.freeze({
    record,
    read() { return { version: 'learned_evidence_evaluation_v1', counts: { ...counts }, automaticRouteAllowed: false }; },
    begin() {
      if (busy) { record('busy'); return null; }
      const signal = AbortSignal.timeout(10_000);
      busy = true;
      let finished = false;
      return Object.freeze({ signal, finish(reason) {
        if (finished) return;
        finished = true; busy = false; record(reason);
      } });
    },
  });
}
