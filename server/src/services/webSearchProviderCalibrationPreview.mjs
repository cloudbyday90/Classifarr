/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { buildWebSearchProviderRouteDiagnostics } from './webSearchProviderRouteDiagnostics.mjs';
import { buildWebSearchProviderCalibrationGuardrails } from './webSearchProviderCalibrationGuardrails.mjs';
import {
  normalizeWebSearchProviderCalibrationPolicy,
} from './webSearchProviderCalibrationPolicies.mjs';
import { webSearchProviderHealthHistory as defaultHealthHistory } from './webSearchProviderHealthHistory.mjs';
import { webSearchProviderRouter as defaultRouter } from './webSearchProviderRouter.mjs';

function toNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildCandidateRankMap(candidates = []) {
  return candidates.reduce((map, candidate, index) => {
    map.set(candidate.providerKey, {
      ...candidate,
      rank: index + 1,
    });
    return map;
  }, new Map());
}

function getQuality(candidate = {}) {
  return candidate.quality || candidate.qualityCalibration || {};
}

function compareNumberValues(currentValue, previewValue) {
  if (currentValue == null || previewValue == null) return null;
  return previewValue - currentValue;
}

function resolveRankDirection(currentCandidate, previewCandidate) {
  if (!currentCandidate && previewCandidate) return 'added';
  if (currentCandidate && !previewCandidate) return 'removed';
  if (!currentCandidate || !previewCandidate) return 'unchanged';
  if (previewCandidate.rank < currentCandidate.rank) return 'moved_up';
  if (previewCandidate.rank > currentCandidate.rank) return 'moved_down';
  return 'unchanged';
}

function buildCandidateChanges(currentCandidates = [], previewCandidates = []) {
  const currentByProvider = buildCandidateRankMap(currentCandidates);
  const previewByProvider = buildCandidateRankMap(previewCandidates);
  const providerKeys = [...new Set([
    ...currentByProvider.keys(),
    ...previewByProvider.keys(),
  ])].sort((left, right) => {
    const leftPreview = previewByProvider.get(left)?.rank ?? Number.MAX_SAFE_INTEGER;
    const rightPreview = previewByProvider.get(right)?.rank ?? Number.MAX_SAFE_INTEGER;
    const leftCurrent = currentByProvider.get(left)?.rank ?? Number.MAX_SAFE_INTEGER;
    const rightCurrent = currentByProvider.get(right)?.rank ?? Number.MAX_SAFE_INTEGER;
    return leftPreview - rightPreview || leftCurrent - rightCurrent || left.localeCompare(right);
  });

  return providerKeys.map((providerKey) => {
    const currentCandidate = currentByProvider.get(providerKey) || null;
    const previewCandidate = previewByProvider.get(providerKey) || null;
    const currentQuality = getQuality(currentCandidate || {});
    const previewQuality = getQuality(previewCandidate || {});
    const currentEffectivePriority = toNumber(currentCandidate?.effectivePriority);
    const previewEffectivePriority = toNumber(previewCandidate?.effectivePriority);
    const currentPriorityPenalty = toNumber(currentQuality.priorityPenalty, 0);
    const previewPriorityPenalty = toNumber(previewQuality.priorityPenalty, 0);
    const currentQualityScore = toNumber(currentQuality.score);
    const previewQualityScore = toNumber(previewQuality.score);

    return Object.freeze({
      providerKey,
      displayName: previewCandidate?.displayName || currentCandidate?.displayName || providerKey,
      currentRank: currentCandidate?.rank || null,
      previewRank: previewCandidate?.rank || null,
      rankDirection: resolveRankDirection(currentCandidate, previewCandidate),
      currentStatus: currentCandidate?.status || null,
      previewStatus: previewCandidate?.status || null,
      statusChanged: (currentCandidate?.status || null) !== (previewCandidate?.status || null),
      currentEffectivePriority,
      previewEffectivePriority,
      effectivePriorityDelta: compareNumberValues(currentEffectivePriority, previewEffectivePriority),
      currentPriorityPenalty,
      previewPriorityPenalty,
      priorityPenaltyDelta: compareNumberValues(currentPriorityPenalty, previewPriorityPenalty),
      currentQualityScore,
      previewQualityScore,
      qualityScoreDelta: compareNumberValues(currentQualityScore, previewQualityScore),
    });
  });
}

export class WebSearchProviderCalibrationPreviewService {
  constructor({
    router = defaultRouter,
    healthHistory = defaultHealthHistory,
    nowFn = () => new Date(),
  } = {}) {
    this.router = router;
    this.healthHistory = healthHistory;
    this.nowFn = nowFn;
  }

  async listRecentHealthEvents() {
    if (!this.healthHistory?.listRecentEvents) return [];
    try {
      return await this.healthHistory.listRecentEvents({ limit: 25 });
    } catch {
      return [];
    }
  }

  async previewPolicy(input = {}) {
    const policy = normalizeWebSearchProviderCalibrationPolicy(input);
    const now = this.router.nowFn?.() || this.nowFn();
    const currentCandidates = await this.router.getRouteCandidates({
      purpose: policy.purpose,
    });
    const previewCandidates = await this.router.getRouteCandidates({
      purpose: policy.purpose,
      calibrationPolicyOverride: policy,
    });
    const current = buildWebSearchProviderRouteDiagnostics(currentCandidates, { now });
    const preview = buildWebSearchProviderRouteDiagnostics(previewCandidates, { now });
    const changes = buildCandidateChanges(current.candidates, preview.candidates);
    const basePreview = Object.freeze({
      purpose: policy.purpose,
      generatedAt: current.evaluatedAt,
      policy,
      selectedProviderKeyBefore: current.selectedProviderKey,
      selectedProviderKeyAfter: preview.selectedProviderKey,
      selectedProviderChanged: current.selectedProviderKey !== preview.selectedProviderKey,
      candidateCount: preview.candidates.length,
      current,
      preview,
      changes: Object.freeze(changes),
    });
    const guardrails = buildWebSearchProviderCalibrationGuardrails(basePreview, {
      recentHealthEvents: await this.listRecentHealthEvents(),
    });

    return Object.freeze({
      ...basePreview,
      guardrails: Object.freeze(guardrails),
    });
  }
}

export const webSearchProviderCalibrationPreviewService = new WebSearchProviderCalibrationPreviewService();
