/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  loadRouteSafetyMaintenanceHandoffGateCounts,
} from '../services/routeSafetyMaintenanceHandoffRepository.mjs';

const previous = {
  days: 7,
  start: new Date('2026-08-17T00:00:00.000Z'),
  end: new Date('2026-08-24T00:00:00.000Z'),
};
const current = {
  days: 7,
  start: new Date('2026-08-24T00:00:00.000Z'),
  end: new Date('2026-08-31T00:00:00.000Z'),
};

describe('routeSafetyMaintenanceHandoffRepository', () => {
  test('reads only fixed, adjacent aggregate gate counts', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{ window_id: 'current', primary_gate_id: 'policy_confirmation_required', observation_count: '4' }],
      }),
    };

    const rows = await loadRouteSafetyMaintenanceHandoffGateCounts(db, { previous, current });

    expect(rows).toHaveLength(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain("CASE WHEN created_at >= $3 THEN 'current' ELSE 'previous' END");
    expect(sql).toContain('COUNT(*)::bigint');
    expect(sql).not.toContain('title');
    expect(sql).not.toContain('library');
    expect(sql).not.toContain('provider');
    expect(sql).not.toContain('prompt');
    expect(params).toEqual([
      previous.start.toISOString(),
      current.end.toISOString(),
      current.start.toISOString(),
      'classification.route_safety.v1',
      expect.arrayContaining(['policy_confirmation_required', 'ai_advisory_cannot_route']),
    ]);
  });

  test('fails before querying when windows overlap or are malformed', async () => {
    const db = { query: jest.fn() };

    await expect(loadRouteSafetyMaintenanceHandoffGateCounts(db, {
      previous,
      current: { ...current, start: new Date('2026-08-23T00:00:00.000Z') },
    })).rejects.toThrow('Valid adjacent route-safety maintenance observation windows');

    expect(db.query).not.toHaveBeenCalled();
  });
});
