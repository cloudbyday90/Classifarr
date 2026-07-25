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
  POLICY_NATIVE_PENDING_ROUTE_OUTCOME_AUDIT_RISK_IDS,
  POLICY_NATIVE_PENDING_ROUTE_OUTCOME_REASON_IDS,
  POLICY_NATIVE_PENDING_ROUTE_OUTCOME_STATUS_IDS,
  buildNativePendingRouteOutcomePatch,
  buildPolicyNativePendingRouteOutcome,
  buildPolicyNativePendingRouteOutcomeAudit,
} from '../../services/policyNativePendingRouteOutcome.mjs';

function buildNativeResolutionProvenance(overrides = {}) {
  return {
    statusId: 'outcome_only',
    selection: {
      eventTypeId: 'operator_confirmed_destination',
      selectedOutcomeId: 'resolve_current_item',
      selectedDestination: {
        libraryId: 6,
        libraryName: 'Animated Movies',
      },
    },
    ...overrides,
  };
}

function buildInput(overrides = {}) {
  return {
    classification: { id: 42, title: 'Do not persist this title' },
    nativeResolutionProvenance: buildNativeResolutionProvenance(),
    routingOutcome: {
      attempted: true,
      routed: true,
      reason: 'routed',
      error: null,
    },
    ...overrides,
  };
}

describe('policyNativePendingRouteOutcome', () => {
  test('records an actual successful route as a separate outcome-only transition', () => {
    const result = buildPolicyNativePendingRouteOutcome(buildInput());

    expect(result).toMatchObject({
      ok: true,
      statusId: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_STATUS_IDS.OUTCOME_ONLY,
      event: {
        eventTypeId: 'route_succeeded',
        sourceEventId: 'classification:42',
        finalDestination: {
          libraryId: 6,
          libraryName: 'Animated Movies',
        },
        routeResult: {
          attempted: true,
          succeeded: true,
          missingMapping: false,
          reasonCode: null,
        },
      },
      finalOutcome: {
        status: 'routed',
      },
      learningGuard: {
        decisionId: 'outcome_only',
        tierId: 'none',
        canWriteLearning: false,
        profileRefreshQueued: false,
      },
      sideEffects: {
        outcomePersisted: false,
        learningWritten: false,
        routingAttempted: false,
      },
      audit: { ok: true },
    });
    expect(JSON.stringify(result)).not.toContain('Do not persist this title');
  });

  test('normalizes missing Arr mapping without treating it as positive evidence', () => {
    const result = buildPolicyNativePendingRouteOutcome(buildInput({
      routingOutcome: {
        attempted: false,
        routed: false,
        reason: 'missing_arr_id',
        error: null,
      },
    }));

    expect(result).toMatchObject({
      statusId: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_STATUS_IDS.OUTCOME_ONLY,
      event: {
        eventTypeId: 'route_failed_missing_mapping',
        routeResult: {
          attempted: true,
          succeeded: false,
          missingMapping: true,
          reasonCode: 'missing_mapping',
        },
      },
      finalOutcome: {
        status: 'route_failed_missing_mapping',
      },
      learningGuard: {
        canWriteLearning: false,
        profileRefreshQueued: false,
      },
      audit: { ok: true },
    });
    expect(result.reasonCodes).toContain(
      POLICY_NATIVE_PENDING_ROUTE_OUTCOME_REASON_IDS.MISSING_MAPPING_RECORDED,
    );
  });

  test('does not manufacture a route event for a transient or invalid routing result', () => {
    const result = buildPolicyNativePendingRouteOutcome(buildInput({
      routingOutcome: {
        attempted: true,
        routed: false,
        reason: 'missing_tmdb_id',
        error: 'do not persist this raw failure',
      },
    }));

    expect(result).toMatchObject({
      statusId: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_STATUS_IDS.NOT_APPLICABLE,
      event: null,
      finalOutcome: null,
      learningGuard: null,
      audit: { ok: true },
    });
    expect(result.reasonCodes).toEqual([
      POLICY_NATIVE_PENDING_ROUTE_OUTCOME_REASON_IDS.ROUTING_NOT_TERMINAL,
    ]);
    expect(JSON.stringify(result)).not.toContain('do not persist this raw failure');
  });

  test('rejects route persistence when resolver provenance has no selected destination', () => {
    const result = buildPolicyNativePendingRouteOutcome(buildInput({
      nativeResolutionProvenance: buildNativeResolutionProvenance({
        selection: {},
      }),
    }));

    expect(result).toMatchObject({
      statusId: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_STATUS_IDS.NOT_APPLICABLE,
      event: null,
      audit: { ok: true },
    });
    expect(result.reasonCodes).toContain(
      POLICY_NATIVE_PENDING_ROUTE_OUTCOME_REASON_IDS.INVALID_NATIVE_SELECTION,
    );
  });

  test('projects a compact patch without raw routing errors or caller-controlled data', () => {
    const routeOutcome = buildPolicyNativePendingRouteOutcome(buildInput({
      routingOutcome: {
        attempted: true,
        routed: false,
        reason: 'no_mapping',
        error: 'radarr address and stack trace must not persist',
      },
    }));
    const patch = buildNativePendingRouteOutcomePatch(routeOutcome);

    expect(patch).toEqual(expect.objectContaining({
      type: 'native_pending_route',
      source: 'policy_request_time',
      event_type_id: 'route_failed_missing_mapping',
      final_library_id: 6,
      final_library_name: 'Animated Movies',
      route_result: {
        attempted: true,
        succeeded: false,
        missing_mapping: true,
        reason_code: 'missing_mapping',
      },
    }));
    expect(JSON.stringify(patch)).not.toContain('stack trace');
    expect(JSON.stringify(patch)).not.toContain('Do not persist this title');
  });

  test('rejects a tampered result that claims a routing side effect', () => {
    const result = buildPolicyNativePendingRouteOutcome(buildInput());
    const audit = buildPolicyNativePendingRouteOutcomeAudit({
      ...result,
      sideEffects: {
        ...result.sideEffects,
        routingAttempted: true,
      },
    });

    expect(audit).toMatchObject({ ok: false, issueCount: 1 });
    expect(audit.issues[0].riskId).toBe(
      POLICY_NATIVE_PENDING_ROUTE_OUTCOME_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
    );
  });
});
