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
  applyAutomaticProfileRecoveryToReadiness,
  buildNativeProfileRecoveryStatus,
} from '../../services/policyNativeProfileRecoveryStatus.mjs';

describe('policyNativeProfileRecoveryStatus', () => {
  test('does not require recovery when cached profile freshness is current', () => {
    expect(buildNativeProfileRecoveryStatus({
      readiness: { stateId: 'ready' },
      activeRefresh: { processingState: 'processing' },
    })).toEqual({
      stateId: 'not_required',
      label: 'Profile current',
      message: 'No automatic profile recovery is needed.',
    });
  });

  test.each([
    ['pending', 'queued'],
    ['processing', 'processing'],
  ])('projects active %s outbox work as %s recovery', (processingState, stateId) => {
    expect(buildNativeProfileRecoveryStatus({
      readiness: { stateId: 'stale_profile' },
      activeRefresh: { processingState },
    }).stateId).toBe(stateId);
  });

  test('presents a delayed native retry as scheduled rather than immediately queued', () => {
    expect(buildNativeProfileRecoveryStatus({
      readiness: { stateId: 'stale_profile' },
      activeRefresh: {
        processingState: 'pending',
        availableAt: '2026-07-26T12:30:00.000Z',
      },
      now: '2026-07-26T12:00:00.000Z',
    }).stateId).toBe('scheduled');
  });

  test('projects a valid current circuit as automatic recovery while active outbox work takes priority', () => {
    const circuit = { valid: true, circuitState: 'open' };

    expect(buildNativeProfileRecoveryStatus({
      readiness: { stateId: 'stale_profile' },
      circuit,
    })).toEqual({
      stateId: 'awaiting_automatic_probe',
      label: 'Recovery awaiting automatic probe',
      message: 'Classifarr is waiting before its next automatic profile recovery check. No action is needed.',
    });
    expect(buildNativeProfileRecoveryStatus({
      readiness: { stateId: 'stale_profile' },
      activeRefresh: { processingState: 'pending' },
      circuit,
    }).stateId).toBe('queued');
  });

  test('shows stale profiles without active work as scheduler-owned recovery', () => {
    const profileRecovery = buildNativeProfileRecoveryStatus({
      readiness: { stateId: 'stale_profile' },
    });
    const readiness = applyAutomaticProfileRecoveryToReadiness({
      readiness: {
        stateId: 'stale_profile',
        nextAction: { actionId: 'refresh_profile', label: 'Refresh profile' },
      },
      profileRecovery,
    });

    expect(profileRecovery).toEqual({
      stateId: 'scheduled',
      label: 'Recovery scheduled',
      message: 'Classifarr will refresh this library profile automatically in the background. No action is needed.',
    });
    expect(readiness.nextAction).toEqual({
      actionId: 'await_automatic_profile_recovery',
      label: 'Profile recovery is automatic',
    });
  });
});
