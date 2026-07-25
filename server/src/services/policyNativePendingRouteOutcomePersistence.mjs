/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { classificationOutcomeService } from './classificationOutcomeService.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  POLICY_NATIVE_PENDING_ROUTE_OUTCOME_STATUS_IDS,
  policyNativePendingRouteOutcomeService,
} from './policyNativePendingRouteOutcome.mjs';

const logger = createLogger('policyNativePendingRouteOutcomePersistence');

function buildPersistenceSummary(routeOutcome = {}) {
  return {
    statusId: routeOutcome.statusId || null,
    eventTypeId: routeOutcome.event?.eventTypeId || null,
    finalOutcomeStatus: routeOutcome.finalOutcome?.status || null,
    reasonCodes: Array.isArray(routeOutcome.reasonCodes) ? routeOutcome.reasonCodes : [],
  };
}

async function recordNativePendingRouteOutcome({
  classificationId,
  nativeResolutionProvenance,
  routingOutcome,
  outcomeService = classificationOutcomeService,
  loggerInstance = logger,
} = {}) {
  const routeOutcome = policyNativePendingRouteOutcomeService.build({
    classification: { id: classificationId },
    nativeResolutionProvenance,
    routingOutcome,
  });

  if (routeOutcome.statusId !== POLICY_NATIVE_PENDING_ROUTE_OUTCOME_STATUS_IDS.OUTCOME_ONLY) {
    return {
      persisted: false,
      reason: 'not_applicable',
      routeOutcome: buildPersistenceSummary(routeOutcome),
    };
  }

  if (routeOutcome.audit.ok !== true) {
    loggerInstance.warn('Native pending route outcome failed audit before persistence', {
      classificationId,
      issueCount: routeOutcome.audit.issueCount,
      riskIds: routeOutcome.audit.issues.map(issue => issue.riskId),
    });
    return {
      persisted: false,
      reason: 'invalid_route_outcome',
      routeOutcome: buildPersistenceSummary(routeOutcome),
    };
  }

  let writeResult;
  try {
    writeResult = await outcomeService.recordOutcome(
      classificationId,
      policyNativePendingRouteOutcomeService.toOutcomePatch(routeOutcome),
    );
  } catch (error) {
    loggerInstance.warn('Native pending route outcome persistence failed unexpectedly', {
      classificationId,
      eventTypeId: routeOutcome.event.eventTypeId,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    return {
      persisted: false,
      reason: 'update_failed',
      routeOutcome: buildPersistenceSummary(routeOutcome),
    };
  }

  if (writeResult.updated !== true) {
    loggerInstance.warn('Could not persist native pending route outcome', {
      classificationId,
      reason: writeResult.reason || 'unknown',
      eventTypeId: routeOutcome.event.eventTypeId,
    });
    return {
      persisted: false,
      reason: writeResult.reason || 'update_failed',
      routeOutcome: buildPersistenceSummary(routeOutcome),
    };
  }

  return {
    persisted: true,
    reason: null,
    routeOutcome: buildPersistenceSummary(routeOutcome),
  };
}

export {
  recordNativePendingRouteOutcome,
};
