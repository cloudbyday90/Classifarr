/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { policyOverlapMetricsCollector } from '../services/policyOverlapMetricsCollector.mjs';

describe('policyOverlapMetricsCollector', () => {
  beforeEach(() => {
    policyOverlapMetricsCollector.reset();
  });

  test('tracks weak primary and overlap decisions with aggregate counts', () => {
    policyOverlapMetricsCollector.recordDecision({
      action: 'prompt_select',
      ranked: [{
        library_id: 10,
        library_name: 'Library 10',
        policy_id: 100,
        policy_name: 'Policy 100',
        candidate_diagnostics: { primary_viability: 'profile_only' },
      }],
      candidateDiagnostics: { primary_viability: 'profile_only' },
      decisionDiagnostics: {
        requires_manual_review: true,
        reason_code: 'weak_evidence_primary',
      },
    });

    policyOverlapMetricsCollector.recordDecision({
      action: 'manual',
      ranked: [
        {
          library_id: 12,
          library_name: 'Library 12',
          policy_id: 120,
          policy_name: 'Policy 120',
          candidate_diagnostics: { primary_viability: 'compatibility_only' },
        },
        {
          library_id: 15,
          library_name: 'Library 15',
          policy_id: 150,
          policy_name: 'Policy 150',
          candidate_diagnostics: { primary_viability: 'profile_only' },
        },
      ],
      candidateDiagnostics: { primary_viability: 'compatibility_only' },
      decisionDiagnostics: {
        requires_manual_review: true,
        reason_code: 'weak_evidence_overlap',
      },
    });

    const snapshot = policyOverlapMetricsCollector.getSnapshot();
    expect(snapshot.total_decisions).toBe(2);
    expect(snapshot.manual_review_recommended_count).toBe(2);
    expect(snapshot.weak_evidence_primary_count).toBe(1);
    expect(snapshot.weak_evidence_overlap_count).toBe(1);
    expect(snapshot.actions).toEqual({
      manual: 1,
      prompt_select: 1,
    });
    expect(snapshot.primary_viability_counts).toEqual({
      compatibility_only: 1,
      profile_only: 1,
    });
    expect(snapshot.top_overlap_pairs).toEqual([
      expect.objectContaining({
        count: 1,
        pair: [
          expect.objectContaining({ library_id: 12 }),
          expect.objectContaining({ library_id: 15 }),
        ],
      }),
    ]);
    expect(snapshot.updated_at).toEqual(expect.any(String));
  });
});
