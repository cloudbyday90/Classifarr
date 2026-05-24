/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function incrementCount(map, key) {
  if (!key) {
    return;
  }
  map.set(key, (map.get(key) || 0) + 1);
}

function toSortedEntries(map, mapper) {
  return Array.from(map.entries())
    .sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])))
    .map(([key, count]) => mapper(key, count));
}

function buildOverlapPairEntry(ranked = []) {
  if (!Array.isArray(ranked) || ranked.length < 2) {
    return null;
  }

  const first = ranked[0];
  const second = ranked[1];
  const sorted = [first, second]
    .map((candidate) => ({
      library_id: candidate?.library_id ?? null,
      library_name: candidate?.library_name ?? null,
      policy_id: candidate?.policy_id ?? null,
      policy_name: candidate?.policy_name ?? null,
    }))
    .sort((left, right) => Number(left.library_id || 0) - Number(right.library_id || 0));

  const pairKey = sorted.map((candidate) => candidate.library_id ?? 'unknown').join(':');
  return {
    pairKey,
    pair: sorted,
  };
}

class PolicyOverlapMetricsCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      totalDecisions: 0,
      weakEvidencePrimaryCount: 0,
      weakEvidenceOverlapCount: 0,
      manualReviewRecommendedCount: 0,
      byAction: new Map(),
      primaryViabilityCounts: new Map(),
      overlapPairs: new Map(),
      updatedAt: null,
    };
  }

  recordDecision({
    action = 'manual',
    ranked = [],
    decisionDiagnostics = null,
    candidateDiagnostics = null,
  } = {}) {
    this.state.totalDecisions += 1;
    incrementCount(this.state.byAction, action);

    const primaryViability = candidateDiagnostics?.primary_viability
      || ranked?.[0]?.candidate_diagnostics?.primary_viability
      || null;
    incrementCount(this.state.primaryViabilityCounts, primaryViability);

    if (decisionDiagnostics?.requires_manual_review) {
      this.state.manualReviewRecommendedCount += 1;
    }

    if (decisionDiagnostics?.reason_code === 'weak_evidence_primary') {
      this.state.weakEvidencePrimaryCount += 1;
    }

    if (decisionDiagnostics?.reason_code === 'weak_evidence_overlap') {
      this.state.weakEvidenceOverlapCount += 1;
      const overlapPair = buildOverlapPairEntry(ranked);
      if (overlapPair) {
        const previous = this.state.overlapPairs.get(overlapPair.pairKey);
        this.state.overlapPairs.set(overlapPair.pairKey, {
          pair: overlapPair.pair,
          count: (previous?.count || 0) + 1,
        });
      }
    }

    this.state.updatedAt = new Date().toISOString();
  }

  getSnapshot() {
    return {
      total_decisions: this.state.totalDecisions,
      weak_evidence_primary_count: this.state.weakEvidencePrimaryCount,
      weak_evidence_overlap_count: this.state.weakEvidenceOverlapCount,
      manual_review_recommended_count: this.state.manualReviewRecommendedCount,
      actions: Object.fromEntries(toSortedEntries(this.state.byAction, (key, count) => [key, count])),
      primary_viability_counts: Object.fromEntries(toSortedEntries(this.state.primaryViabilityCounts, (key, count) => [key, count])),
      top_overlap_pairs: Array.from(this.state.overlapPairs.values())
        .sort((left, right) => right.count - left.count)
        .slice(0, 10)
        .map((entry) => ({
          count: entry.count,
          pair: entry.pair,
        })),
      updated_at: this.state.updatedAt,
    };
  }
}

export const policyOverlapMetricsCollector = new PolicyOverlapMetricsCollector();
