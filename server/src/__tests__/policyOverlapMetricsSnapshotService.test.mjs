/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import { createNamedMockModule, createLoggerModuleMock } from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));
jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const { policyOverlapMetricsCollector } = await import('../services/policyOverlapMetricsCollector.mjs');
const { policyOverlapMetricsSnapshotService } = await import('../services/policyOverlapMetricsSnapshotService.mjs');

describe('policyOverlapMetricsSnapshotService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    policyOverlapMetricsCollector.reset();
    policyOverlapMetricsSnapshotService.resetRuntimeState();
  });

  test('persists normalized snapshots when forced', async () => {
    policyOverlapMetricsCollector.recordDecision({
      action: 'manual',
      ranked: [
        {
          library_id: 1,
          library_name: 'Movies',
          policy_id: 11,
          policy_name: 'Movies Policy',
          candidate_diagnostics: { primary_viability: 'compatibility_only' },
        },
        {
          library_id: 2,
          library_name: 'Comedy',
          policy_id: 12,
          policy_name: 'Comedy Policy',
          candidate_diagnostics: { primary_viability: 'profile_only' },
        },
      ],
      candidateDiagnostics: { primary_viability: 'compatibility_only' },
      decisionDiagnostics: {
        requires_manual_review: true,
        reason_code: 'weak_evidence_overlap',
      },
    });

    mockDb.query.mockResolvedValueOnce({
      rows: [{
        id: 5,
        session_id: policyOverlapMetricsCollector.getSnapshot().session_id,
        session_started_at: policyOverlapMetricsCollector.getSnapshot().session_started_at,
        snapshot_reason: 'unit_test',
        decision_delta: 1,
        total_decisions: 1,
        weak_evidence_primary_count: 0,
        weak_evidence_overlap_count: 1,
        manual_review_recommended_count: 1,
        actions: { manual: 1 },
        primary_viability_counts: { compatibility_only: 1 },
        top_overlap_pairs: [{ count: 1, pair: [{ library_id: 1 }, { library_id: 2 }] }],
        created_at: new Date().toISOString(),
      }],
    });

    const result = await policyOverlapMetricsSnapshotService.persistSnapshot({
      force: true,
      reason: 'unit_test',
    });

    expect(result.persisted).toBe(true);
    expect(result.snapshot).toEqual(expect.objectContaining({
      id: 5,
      snapshot_reason: 'unit_test',
      weak_evidence_overlap_count: 1,
    }));
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_overlap_metrics_snapshots'),
      expect.arrayContaining([expect.any(String), expect.any(String), 'unit_test'])
    );
  });

  test('returns empty-safe values when the snapshot table is unavailable', async () => {
    const missingTableError = Object.assign(new Error('missing'), { code: '42P01' });
    mockDb.query.mockRejectedValueOnce(missingTableError);
    await expect(policyOverlapMetricsSnapshotService.getLatestSnapshot()).resolves.toBeNull();

    mockDb.query.mockRejectedValueOnce(missingTableError);
    await expect(policyOverlapMetricsSnapshotService.listRecentSnapshots(10)).resolves.toEqual([]);
  });
});
