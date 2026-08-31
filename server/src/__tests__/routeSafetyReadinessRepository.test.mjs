/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  loadRouteSafetyReadinessPrimaryGateCounts,
} from '../services/routeSafetyReadinessRepository.mjs';

describe('routeSafetyReadinessRepository', () => {
  test('reads only versioned, allow-listed gate aggregates over a fixed range', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{ primary_gate_id: 'policy_confirmation_required', observation_count: '3' }],
      }),
    };
    const start = new Date('2026-08-24T00:00:00.000Z');
    const end = new Date('2026-08-31T00:00:00.000Z');

    const rows = await loadRouteSafetyReadinessPrimaryGateCounts(db, { start, end });

    expect(rows).toEqual([{ primary_gate_id: 'policy_confirmation_required', observation_count: '3' }]);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('primary_gate,id')
    expect(sql).toContain('COUNT(*)::bigint')
    expect(sql).not.toContain('title')
    expect(sql).not.toContain('library')
    expect(sql).not.toContain('provider')
    expect(sql).not.toContain('prompt')
    expect(sql).not.toContain('response')
    expect(params).toEqual([
      start.toISOString(),
      end.toISOString(),
      'classification.route_safety.v1',
      expect.arrayContaining(['policy_confirmation_required', 'ai_advisory_cannot_route']),
    ]);
  });

  test('fails closed before a malformed aggregate range reaches the database', async () => {
    const db = { query: jest.fn() };

    await expect(loadRouteSafetyReadinessPrimaryGateCounts(db, {
      start: new Date('2026-08-31T00:00:00.000Z'),
      end: new Date('2026-08-24T00:00:00.000Z'),
    })).rejects.toThrow('valid route-safety readiness observation range');

    expect(db.query).not.toHaveBeenCalled();
  });
});
