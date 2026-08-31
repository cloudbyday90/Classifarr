/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  ROUTE_SAFETY_MAINTENANCE_HANDOFF_VERSION,
  buildRouteSafetyMaintenanceHandoffReport,
  buildRouteSafetyMaintenanceHandoffWindows,
} from '../services/routeSafetyMaintenanceHandoff.mjs';

describe('routeSafetyMaintenanceHandoff', () => {
  test('recommends only a stable, representative, policy-owned primary gate', () => {
    const windows = buildRouteSafetyMaintenanceHandoffWindows({
      now: new Date('2026-08-31T13:00:00.000Z'),
    });
    const report = buildRouteSafetyMaintenanceHandoffReport({
      rows: [
        { window_id: 'previous', primary_gate_id: 'policy_confirmation_required', observation_count: '5' },
        { window_id: 'previous', primary_gate_id: 'low_confidence_review_required', observation_count: '1' },
        { window_id: 'current', primary_gate_id: 'policy_confirmation_required', observation_count: '4' },
        { window_id: 'current', primary_gate_id: 'low_confidence_review_required', observation_count: '2' },
        { window_id: 'current', primary_gate_id: 'unknown_gate', observation_count: '999', title: 'Private title' },
      ],
      windows,
    });

    expect(report).toEqual(expect.objectContaining({
      version: ROUTE_SAFETY_MAINTENANCE_HANDOFF_VERSION,
      status: { id: 'review_recommended' },
      windows: {
        previous: { days: 7, startDate: '2026-08-17', endDate: '2026-08-24' },
        current: { days: 7, startDate: '2026-08-24', endDate: '2026-08-31' },
      },
      handoff: {
        gateId: 'policy_confirmation_required',
        previousCount: 5,
        currentCount: 4,
        previousObservationCount: 6,
        currentObservationCount: 6,
      },
    }));
    expect(JSON.stringify(report)).not.toContain('Private title');
  });

  test('fails closed when a repeated gate is not representative in both windows', () => {
    const report = buildRouteSafetyMaintenanceHandoffReport({
      rows: [
        { window_id: 'previous', primary_gate_id: 'policy_confirmation_required', observation_count: '4' },
        { window_id: 'previous', primary_gate_id: 'low_confidence_review_required', observation_count: '2' },
        { window_id: 'current', primary_gate_id: 'policy_confirmation_required', observation_count: '4' },
        { window_id: 'current', primary_gate_id: 'low_confidence_review_required', observation_count: '5' },
      ],
      windows: buildRouteSafetyMaintenanceHandoffWindows({
        now: new Date('2026-08-31T13:00:00.000Z'),
      }),
    });

    expect(report).toMatchObject({
      status: { id: 'not_recommended' },
      handoff: null,
    });
  });
});
