/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import {
  normalizePolicyDecisionThresholds,
  POLICY_PROMPT_SELECT_MIN_CONFIDENCE,
} from '../utils/policyThresholds.mjs';

class PolicyDecisionBuilder {
  deriveTopCandidate(result) {
    if (result.topCandidate) {
      return result.topCandidate;
    }

    const top = Array.isArray(result.ranked) && result.ranked.length > 0 ? result.ranked[0] : null;
    if (!top) {
      return null;
    }

    return {
      library_id: top.library_id,
      library_name: top.library_name,
      policy_id: top.policy_id,
      policy_name: top.policy_name,
      score: top.score
    };
  }

  normalizeResult(result = {}) {
    const ranked = Array.isArray(result.ranked) ? result.ranked : [];
    const top = ranked[0] || null;
    const topCandidate = this.deriveTopCandidate({ ...result, ranked });
    const normalizedThresholds = top ? normalizePolicyDecisionThresholds(top) : null;
    const thresholds = result.thresholds || {
      auto_classify: normalizedThresholds?.autoClassifyThreshold ?? null,
      prompt: normalizedThresholds?.promptThreshold ?? null,
      prompt_select: POLICY_PROMPT_SELECT_MIN_CONFIDENCE
    };

    return {
      ...result,
      ranked,
      confidence: result.confidence ?? top?.score ?? 0,
      topCandidate,
      scores: result.scores ?? top?.scores ?? {},
      weights: result.weights ?? top?.weights ?? {},
      breakdown: result.breakdown ?? top?.breakdown ?? [],
      agreement: result.agreement ?? top?.agreement ?? null,
      thresholds
    };
  }

  buildPolicyDecision({ action, ranked, top = null, method = 'policy_engine' }) {
    const candidate = top || (Array.isArray(ranked) && ranked.length > 0 ? ranked[0] : null);
    const baseResult = {
      action,
      confidence: candidate?.score ?? 0,
      method,
      ranked: Array.isArray(ranked) ? ranked : []
    };

    if (candidate) {
      baseResult.library = {
        library_id: candidate.library_id,
        library_name: candidate.library_name,
        policy_id: candidate.policy_id,
        policy_name: candidate.policy_name
      };
      baseResult.scores = candidate.scores;
      baseResult.weights = candidate.weights;
      baseResult.breakdown = candidate.breakdown;
      baseResult.agreement = candidate.agreement;
    }

    if (action === 'prompt_select' || action === 'manual') {
      delete baseResult.library;
    }

    return this.normalizeResult(baseResult);
  }
}

export { PolicyDecisionBuilder };
export default new PolicyDecisionBuilder();
