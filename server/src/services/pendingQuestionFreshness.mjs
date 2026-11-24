/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { createLogger } from '../utils/logger.mjs';
import { safeParseJson } from './clarificationUtils.mjs';
import { getRuntimeQuestionNormalizationStatus } from './policyRuntimeQuestionNormalizer.mjs';

const logger = createLogger('PendingQuestionFreshness');
export const POLICY_CONTEXT_UNAVAILABLE = 'policy_context_unavailable';

function annotate(row, question, version = null, reason = null) {
  return {
    ...row,
    policy_question: question,
    policy_question_stale: reason !== null,
    policy_question_current_context_version: version,
    policy_question_stale_reason: reason,
  };
}

export function createPendingQuestionFreshnessReader(db, {
  buildQuestionContextCacheKey,
  extractQuestionContext,
  getPolicyQuestionContextVersion,
  isPolicyQuestionStale,
}) {
  const versions = new Map();

  async function loadContextVersion(context) {
    try {
      return await getPolicyQuestionContextVersion(db, context);
    } catch {
      logger.warn('Pending question context lookup unavailable', null, {
        skipDbPersist: true,
        dedupeKey: POLICY_CONTEXT_UNAVAILABLE,
      });
      return undefined;
    }
  }

  return async row => {
    const question = typeof row.policy_question === 'string'
      ? safeParseJson(row.policy_question)
      : row.policy_question;
    if (!question) return annotate(row, null);

    const context = extractQuestionContext(question);
    const status = getRuntimeQuestionNormalizationStatus(question, context);
    if (!status.actionable) return annotate(row, question, null, status.reason);

    const key = buildQuestionContextCacheKey(context);
    if (!versions.has(key)) versions.set(key, loadContextVersion(context));
    const version = await versions.get(key);
    if (version === undefined) return annotate(row, question, null, POLICY_CONTEXT_UNAVAILABLE);

    const reason = isPolicyQuestionStale(question, version) ? 'policy_context_changed' : null;
    return annotate(row, question, version, reason);
  };
}
