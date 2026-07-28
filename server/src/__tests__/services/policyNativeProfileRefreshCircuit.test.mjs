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
  buildCircuitDecision,
  buildPolicyNativeProfileRefreshCircuitFailureTransition,
  buildPolicyNativeProfileRefreshCircuitProbeDeferral,
  buildPolicyNativeProfileRefreshCircuitProbeTransition,
} from '../../services/policyNativeProfileRefreshCircuit.mjs';

const NOW = new Date('2026-07-28T12:00:00.000Z');

describe('policyNativeProfileRefreshCircuit', () => {
  test('opens after three recoverable terminal failures and delays the next probe', () => {
    const transition = buildPolicyNativeProfileRefreshCircuitFailureTransition({
      failedOutboxId: 93,
      failureCount: 3,
      failureCode: 'profile_refresh_unknown_failed',
      now: NOW,
    });

    expect(transition).toMatchObject({
      ready: true,
      changed: true,
      opened: true,
      circuit: {
        circuitState: 'open',
        consecutiveFailureCount: 3,
        lastTerminalOutboxId: 93,
        nextProbeAt: '2026-07-28T14:00:00.000Z',
      },
    });
    expect(buildCircuitDecision({ circuit: transition.circuit, now: NOW })).toMatchObject({
      actionId: 'block',
      reasonCodes: ['native_profile_refresh_circuit_open'],
    });
  });

  test('opens immediately for a fixed configuration failure and allows one later probe', () => {
    const transition = buildPolicyNativeProfileRefreshCircuitFailureTransition({
      failedOutboxId: 91,
      failureCount: 1,
      failureCode: 'profile_refresh_configuration_invalid',
      now: NOW,
    });

    expect(transition.circuit).toMatchObject({
      circuitState: 'open',
      consecutiveFailureCount: 1,
      nextProbeAt: '2026-07-28T14:00:00.000Z',
    });
    expect(buildCircuitDecision({
      circuit: transition.circuit,
      now: new Date('2026-07-28T14:00:00.000Z'),
    })).toMatchObject({ actionId: 'enqueue_probe' });
  });

  test('moves a due circuit to half-open for one outbox-backed probe', () => {
    const openCircuit = buildPolicyNativeProfileRefreshCircuitFailureTransition({
      failedOutboxId: 93,
      failureCount: 3,
      failureCode: 'profile_refresh_transient_dependency_failed',
      now: NOW,
    }).circuit;
    const probe = buildPolicyNativeProfileRefreshCircuitProbeTransition({
      circuit: openCircuit,
      probeOutboxId: 94,
      now: new Date('2026-07-28T14:00:00.000Z'),
    });

    expect(probe).toMatchObject({
      ready: true,
      circuit: {
        circuitState: 'half_open',
        probeOutboxId: 94,
        nextProbeAt: null,
      },
    });
    expect(buildCircuitDecision({ circuit: probe.circuit, now: NOW })).toMatchObject({
      actionId: 'block',
      reasonCodes: ['native_profile_refresh_circuit_probe_in_progress'],
    });
  });

  test('defers a due probe when active work coalesces it instead of retrying every scheduler tick', () => {
    const openCircuit = buildPolicyNativeProfileRefreshCircuitFailureTransition({
      failedOutboxId: 93,
      failureCount: 3,
      failureCode: 'profile_refresh_unknown_failed',
      now: NOW,
    }).circuit;

    expect(buildPolicyNativeProfileRefreshCircuitProbeDeferral({
      circuit: openCircuit,
      now: new Date('2026-07-28T14:00:00.000Z'),
    })).toMatchObject({
      ready: true,
      circuit: { nextProbeAt: '2026-07-28T14:05:00.000Z' },
    });
  });

  test('does not record an unknown durable failure code as a recoverable circuit state', () => {
    expect(buildPolicyNativeProfileRefreshCircuitFailureTransition({
      failedOutboxId: 91,
      failureCount: 1,
      failureCode: 'untrusted_failure_code',
      now: NOW,
    })).toMatchObject({
      ready: false,
      reasonCodes: ['invalid_native_profile_refresh_circuit_failure'],
    });
  });
});
