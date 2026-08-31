/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  ROUTE_SAFETY_READINESS_VERSION,
  buildRouteSafetyReadinessReport,
  buildRouteSafetyReadinessWindow,
} from '../services/routeSafetyReadiness.mjs';

describe('routeSafetyReadiness', () => {
  test('builds a fixed, content-free report from allow-listed primary-gate aggregates', () => {
    const report = buildRouteSafetyReadinessReport({
      rows: [
        { primary_gate_id: 'policy_confirmation_required', observation_count: '5' },
        { primary_gate_id: 'policy_destination_selection_required', observation_count: '2' },
        { primary_gate_id: 'unknown_gate', observation_count: '99', title: 'Must not render' },
        { primary_gate_id: 'policy_confirmation_required', observation_count: 'malformed' },
      ],
      window: buildRouteSafetyReadinessWindow({ now: new Date('2026-08-31T13:00:00.000Z') }),
    });

    expect(report).toEqual(expect.objectContaining({
      version: ROUTE_SAFETY_READINESS_VERSION,
      routeSafetyVersion: 'classification.route_safety.v1',
      window: {
        days: 7,
        startDate: '2026-08-24',
        endDate: '2026-08-31',
      },
      observationCount: 7,
      primaryGates: [
        { id: 'policy_confirmation_required', label: 'Policy confirmation', count: 5 },
        { id: 'policy_destination_selection_required', label: 'Destination selection', count: 2 },
      ],
      status: expect.objectContaining({ id: 'safeguards_observed' }),
    }));
    expect(JSON.stringify(report)).not.toContain('Must not render');
  });

  test('does not treat a quiet completed window as a healthy policy verdict', () => {
    const report = buildRouteSafetyReadinessReport({
      rows: [],
      window: buildRouteSafetyReadinessWindow({ now: new Date('2026-08-31T13:00:00.000Z') }),
    });

    expect(report).toMatchObject({
      observationCount: 0,
      primaryGates: [],
      status: {
        id: 'no_recent_safeguard_decisions',
      },
    });
    expect(report.status.message).toContain('not a policy-health')
  });
});
