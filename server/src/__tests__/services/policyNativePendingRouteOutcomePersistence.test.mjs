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
import {
  recordNativePendingRouteOutcome,
} from '../../services/policyNativePendingRouteOutcomePersistence.mjs';

function buildInput(overrides = {}) {
  return {
    classificationId: 42,
    nativeResolutionProvenance: {
      statusId: 'outcome_only',
      selection: {
        selectedDestination: {
          libraryId: 6,
          libraryName: 'Animated Movies',
        },
      },
    },
    routingOutcome: {
      attempted: true,
      routed: true,
      reason: 'routed',
      error: null,
    },
    ...overrides,
  };
}

function buildDependencies(overrides = {}) {
  return {
    outcomeService: {
      recordOutcome: jest.fn().mockResolvedValue({ updated: true }),
    },
    loggerInstance: {
      warn: jest.fn(),
    },
    ...overrides,
  };
}

describe('policyNativePendingRouteOutcomePersistence', () => {
  test('persists the compact terminal route patch after routing has returned', async () => {
    const dependencies = buildDependencies();
    const result = await recordNativePendingRouteOutcome({
      ...buildInput(),
      ...dependencies,
    });

    expect(result).toEqual(expect.objectContaining({
      persisted: true,
      reason: null,
      routeOutcome: expect.objectContaining({
        eventTypeId: 'route_succeeded',
        finalOutcomeStatus: 'routed',
      }),
    }));
    expect(dependencies.outcomeService.recordOutcome).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        type: 'native_pending_route',
        event_type_id: 'route_succeeded',
        final_library_id: 6,
      }),
    );
  });

  test('does not write a non-terminal routing result', async () => {
    const dependencies = buildDependencies();
    const result = await recordNativePendingRouteOutcome({
      ...buildInput({
        routingOutcome: {
          attempted: true,
          routed: false,
          reason: 'missing_tmdb_id',
        },
      }),
      ...dependencies,
    });

    expect(result).toEqual(expect.objectContaining({
      persisted: false,
      reason: 'not_applicable',
      routeOutcome: expect.objectContaining({ eventTypeId: null }),
    }));
    expect(dependencies.outcomeService.recordOutcome).not.toHaveBeenCalled();
  });

  test('reports a failed outcome write without throwing or changing route semantics', async () => {
    const dependencies = buildDependencies({
      outcomeService: {
        recordOutcome: jest.fn().mockResolvedValue({
          updated: false,
          reason: 'update_failed',
        }),
      },
    });
    const result = await recordNativePendingRouteOutcome({
      ...buildInput(),
      ...dependencies,
    });

    expect(result).toEqual(expect.objectContaining({
      persisted: false,
      reason: 'update_failed',
      routeOutcome: expect.objectContaining({ eventTypeId: 'route_succeeded' }),
    }));
    expect(dependencies.loggerInstance.warn).toHaveBeenCalledWith(
      'Could not persist native pending route outcome',
      expect.objectContaining({ classificationId: 42, eventTypeId: 'route_succeeded' }),
    );
  });

  test('contains an unexpected persistence exception and reports a bounded result', async () => {
    const dependencies = buildDependencies({
      outcomeService: {
        recordOutcome: jest.fn().mockRejectedValue(new Error('database unavailable')),
      },
    });
    const result = await recordNativePendingRouteOutcome({
      ...buildInput(),
      ...dependencies,
    });

    expect(result).toEqual(expect.objectContaining({
      persisted: false,
      reason: 'update_failed',
      routeOutcome: expect.objectContaining({ eventTypeId: 'route_succeeded' }),
    }));
    expect(dependencies.loggerInstance.warn).toHaveBeenCalledWith(
      'Native pending route outcome persistence failed unexpectedly',
      expect.objectContaining({ classificationId: 42, eventTypeId: 'route_succeeded' }),
    );
  });
});
