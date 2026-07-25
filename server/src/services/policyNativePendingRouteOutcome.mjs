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
  ANSWER_OUTCOME_IDS,
  QUESTION_FRAME_IDS,
} from './policyQuestionLearningVocabulary.mjs';
import {
  POLICY_LEARNING_EVENT_SOURCE_IDS,
  buildPolicyLearningDecision,
  buildPolicyLearningGuardAudit,
} from './policyLearningGuard.mjs';
import {
  POLICY_FINAL_OUTCOME_STATUS_IDS,
  buildPolicyFinalOutcomeAudit,
} from './policyFinalOutcomeNormalizer.mjs';
import {
  POLICY_REQUEST_EVENT_TYPE_IDS,
  buildPolicyRequestTimeEvent,
  validatePolicyRequestTimeEvent,
} from './policyRequestTimeEvent.mjs';
import {
  POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_STATUS_IDS,
} from './policyNativePendingResolutionProvenance.mjs';

const POLICY_NATIVE_PENDING_ROUTE_OUTCOME_VERSION =
  'policy.native_pending_route_outcome.v1';

const POLICY_NATIVE_PENDING_ROUTE_OUTCOME_STATUS_IDS = Object.freeze({
  NOT_APPLICABLE: 'not_applicable',
  OUTCOME_ONLY: 'outcome_only',
});

const POLICY_NATIVE_PENDING_ROUTE_OUTCOME_REASON_IDS = Object.freeze({
  NOT_NATIVE_PENDING_RESOLUTION: 'native_pending_route_not_native_pending_resolution',
  INVALID_NATIVE_SELECTION: 'native_pending_route_invalid_native_selection',
  ROUTING_NOT_TERMINAL: 'native_pending_route_routing_not_terminal',
  ROUTE_SUCCEEDED_RECORDED: 'native_pending_route_succeeded_recorded',
  MISSING_MAPPING_RECORDED: 'native_pending_route_missing_mapping_recorded',
});

const POLICY_NATIVE_PENDING_ROUTE_OUTCOME_AUDIT_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_native_pending_route_outcome_version',
  INVALID_STATUS: 'invalid_native_pending_route_outcome_status',
  INVALID_EVENT: 'invalid_native_pending_route_outcome_event',
  INVALID_FINAL_OUTCOME: 'invalid_native_pending_route_outcome_final_outcome',
  INVALID_LEARNING_GUARD: 'invalid_native_pending_route_outcome_learning_guard',
  LEARNING_WRITE_ALLOWED: 'native_pending_route_outcome_learning_write_allowed',
  PROFILE_REFRESH_QUEUED: 'native_pending_route_outcome_profile_refresh_queued',
  INVALID_DESTINATION: 'invalid_native_pending_route_outcome_destination',
  SIDE_EFFECT_REPORTED: 'native_pending_route_outcome_side_effect_reported',
});

const MISSING_MAPPING_ROUTE_REASON_IDS = new Set(['no_mapping', 'missing_arr_id']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = 160) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function uniqueReasonCodes(reasonCodes = []) {
  return [...new Set(reasonCodes.filter(Boolean))];
}

function buildDestination(selection = {}) {
  const selectedDestination = asObject(asObject(selection).selectedDestination);

  return {
    libraryId: normalizePositiveInteger(selectedDestination.libraryId),
    libraryName: normalizeString(selectedDestination.libraryName) || null,
  };
}

function buildNotApplicableResult(reasonCode) {
  const result = {
    version: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_VERSION,
    ok: true,
    statusId: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_STATUS_IDS.NOT_APPLICABLE,
    event: null,
    finalOutcome: null,
    learningGuard: null,
    reasonCodes: [reasonCode],
    sideEffects: {
      outcomePersisted: false,
      learningWritten: false,
      profileRefreshQueued: false,
      routingAttempted: false,
      providerLookupPerformed: false,
      providerQuotaRead: false,
    },
  };

  return {
    ...result,
    audit: buildPolicyNativePendingRouteOutcomeAudit(result),
  };
}

function getTerminalRouteEventType(routing = {}) {
  const route = asObject(routing);

  if (route.routed === true) {
    return POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED;
  }

  if (MISSING_MAPPING_ROUTE_REASON_IDS.has(normalizeString(route.reason, 80))) {
    return POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING;
  }

  return null;
}

function buildRouteEvent({ classificationId, destination, routing }) {
  const eventTypeId = getTerminalRouteEventType(routing);
  if (!eventTypeId) return null;

  return buildPolicyRequestTimeEvent({
    eventTypeId,
    item: {
      itemId: classificationId,
    },
    finalDestination: destination,
    routeResult: {
      attempted: asObject(routing).attempted === true,
      succeeded: eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED,
      missingMapping: eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING,
      reasonCode: eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING
        ? 'missing_mapping'
        : null,
    },
    sourceEventId: `classification:${classificationId}`,
  });
}

function buildLearningDecision(requestEvent) {
  const routeFailed =
    requestEvent.eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING;
  const destination = asObject(requestEvent.finalDestination);

  return buildPolicyLearningDecision({
    sourceId: POLICY_LEARNING_EVENT_SOURCE_IDS.ARR_ROUTING_OUTCOME,
    answerOutcomeId: ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
    question: {
      frameId: routeFailed
        ? QUESTION_FRAME_IDS.ROUTING_GAP
        : QUESTION_FRAME_IDS.DESTINATION_FIT,
      stale: false,
    },
    answer: {
      // This is a stable server-owned description, never a user-supplied label.
      label: 'Routing destination',
      destinationLibraryId: destination.libraryId,
      destinationLibraryName: destination.libraryName,
      ambiguous: false,
    },
    finalOutcome: {
      itemId: requestEvent.item.itemId,
      destinationLibraryId: destination.libraryId,
      destinationLibraryName: destination.libraryName,
      status: routeFailed
        ? POLICY_FINAL_OUTCOME_STATUS_IDS.ROUTE_FAILED_MISSING_MAPPING
        : POLICY_FINAL_OUTCOME_STATUS_IDS.ROUTED,
      route: requestEvent.routeResult,
      recorded: true,
    },
  });
}

function buildEventSummary(event = {}) {
  const routeEvent = asObject(event);
  const destination = asObject(routeEvent.finalDestination);
  const routeResult = asObject(routeEvent.routeResult);

  return {
    version: normalizeString(routeEvent.version, 80) || null,
    eventTypeId: normalizeString(routeEvent.eventTypeId, 80) || null,
    sourceEventId: normalizeString(routeEvent.sourceEventId, 120) || null,
    finalDestination: {
      libraryId: normalizePositiveInteger(destination.libraryId),
      libraryName: normalizeString(destination.libraryName) || null,
    },
    routeResult: {
      attempted: routeResult.attempted === true,
      succeeded: routeResult.succeeded === true,
      missingMapping: routeResult.missingMapping === true,
      reasonCode: normalizeString(routeResult.reasonCode, 80) || null,
    },
  };
}

function buildLearningGuardSummary(learningDecision = {}) {
  const decision = asObject(learningDecision);
  const learning = asObject(decision.learning);
  const profileRefresh = asObject(decision.profileRefresh);

  return {
    version: normalizeString(decision.version, 80) || null,
    sourceId: normalizeString(decision.sourceId, 80) || null,
    decisionId: normalizeString(learning.decisionId, 80) || null,
    tierId: normalizeString(learning.tierId, 80) || null,
    canWriteLearning: learning.canWriteLearning === true,
    profileRefreshQueued: profileRefresh.queue === true,
  };
}

function buildPolicyNativePendingRouteOutcome({
  classification = {},
  nativeResolutionProvenance = null,
  routingOutcome = {},
} = {}) {
  const provenance = asObject(nativeResolutionProvenance);
  if (provenance.statusId !== POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_STATUS_IDS.OUTCOME_ONLY) {
    return buildNotApplicableResult(
      POLICY_NATIVE_PENDING_ROUTE_OUTCOME_REASON_IDS.NOT_NATIVE_PENDING_RESOLUTION
    );
  }

  const classificationId = normalizePositiveInteger(asObject(classification).id ?? classification);
  const destination = buildDestination(provenance.selection);
  if (!classificationId || !destination.libraryId || !destination.libraryName) {
    return buildNotApplicableResult(
      POLICY_NATIVE_PENDING_ROUTE_OUTCOME_REASON_IDS.INVALID_NATIVE_SELECTION
    );
  }

  const requestEvent = buildRouteEvent({
    classificationId,
    destination,
    routing: routingOutcome,
  });
  if (!requestEvent) {
    return buildNotApplicableResult(
      POLICY_NATIVE_PENDING_ROUTE_OUTCOME_REASON_IDS.ROUTING_NOT_TERMINAL
    );
  }

  const learningDecision = buildLearningDecision(requestEvent);
  const reasonCodes = [
    requestEvent.eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED
      ? POLICY_NATIVE_PENDING_ROUTE_OUTCOME_REASON_IDS.ROUTE_SUCCEEDED_RECORDED
      : POLICY_NATIVE_PENDING_ROUTE_OUTCOME_REASON_IDS.MISSING_MAPPING_RECORDED,
  ];
  const result = {
    version: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_VERSION,
    ok: true,
    statusId: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_STATUS_IDS.OUTCOME_ONLY,
    event: buildEventSummary(requestEvent),
    finalOutcome: learningDecision.finalOutcome,
    learningGuard: buildLearningGuardSummary(learningDecision),
    reasonCodes: uniqueReasonCodes(reasonCodes),
    sideEffects: {
      outcomePersisted: false,
      learningWritten: false,
      profileRefreshQueued: false,
      routingAttempted: false,
      providerLookupPerformed: false,
      providerQuotaRead: false,
    },
  };

  return {
    ...result,
    audit: buildPolicyNativePendingRouteOutcomeAudit(result, {
      learningDecision,
      requestEvent,
    }),
  };
}

function buildPolicyNativePendingRouteOutcomeAudit(result = {}, internal = {}) {
  const source = asObject(result);
  const event = asObject(source.event);
  const destination = asObject(event.finalDestination);
  const learningGuard = asObject(source.learningGuard);
  const learningDecision = internal.learningDecision;
  const requestEvent = internal.requestEvent;
  const sideEffects = asObject(source.sideEffects);
  const issues = [];

  if (source.version !== POLICY_NATIVE_PENDING_ROUTE_OUTCOME_VERSION) {
    issues.push({
      riskId: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_AUDIT_RISK_IDS.INVALID_VERSION,
      message: 'Native pending-route outcomes must use the current contract version.',
    });
  }

  if (!Object.values(POLICY_NATIVE_PENDING_ROUTE_OUTCOME_STATUS_IDS).includes(source.statusId)) {
    issues.push({
      riskId: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_AUDIT_RISK_IDS.INVALID_STATUS,
      message: 'Native pending-route outcomes must use a supported status.',
    });
  }

  if (source.statusId === POLICY_NATIVE_PENDING_ROUTE_OUTCOME_STATUS_IDS.OUTCOME_ONLY) {
    const validEventType = [
      POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED,
      POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING,
    ].includes(event.eventTypeId);
    if (!validEventType || (requestEvent && validatePolicyRequestTimeEvent(requestEvent).ok !== true)) {
      issues.push({
        riskId: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_AUDIT_RISK_IDS.INVALID_EVENT,
        message: 'A native pending-route outcome must retain a valid terminal request-time event.',
      });
    }

    if (!normalizePositiveInteger(destination.libraryId) || !normalizeString(destination.libraryName)) {
      issues.push({
        riskId: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_AUDIT_RISK_IDS.INVALID_DESTINATION,
        message: 'A native pending-route outcome requires the resolver-selected destination.',
      });
    }

    if (buildPolicyFinalOutcomeAudit(source.finalOutcome).ok !== true) {
      issues.push({
        riskId: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_AUDIT_RISK_IDS.INVALID_FINAL_OUTCOME,
        message: 'A native pending-route outcome must contain a valid final outcome.',
      });
    }

    if (learningDecision && buildPolicyLearningGuardAudit(learningDecision).ok !== true) {
      issues.push({
        riskId: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_AUDIT_RISK_IDS.INVALID_LEARNING_GUARD,
        message: 'A native pending-route outcome must pass through a valid learning guard.',
      });
    }

    if (learningGuard.canWriteLearning === true) {
      issues.push({
        riskId: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_AUDIT_RISK_IDS.LEARNING_WRITE_ALLOWED,
        message: 'Native pending-route outcomes must remain outcome-only.',
      });
    }

    if (learningGuard.profileRefreshQueued === true) {
      issues.push({
        riskId: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_AUDIT_RISK_IDS.PROFILE_REFRESH_QUEUED,
        message: 'Native pending-route outcomes cannot queue a profile refresh.',
      });
    }
  }

  const prohibitedSideEffect = [
    'outcomePersisted',
    'learningWritten',
    'profileRefreshQueued',
    'routingAttempted',
    'providerLookupPerformed',
    'providerQuotaRead',
  ].find(sideEffectId => sideEffects[sideEffectId] === true);
  if (prohibitedSideEffect) {
    issues.push({
      riskId: POLICY_NATIVE_PENDING_ROUTE_OUTCOME_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
      message: 'The native pending-route outcome adapter must remain side-effect free.',
      sideEffectId: prohibitedSideEffect,
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildNativePendingRouteOutcomePatch(routeOutcome = {}) {
  const source = asObject(routeOutcome);
  const event = asObject(source.event);
  const destination = asObject(event.finalDestination);
  const routeResult = asObject(event.routeResult);

  return {
    type: 'native_pending_route',
    source: 'policy_request_time',
    event_type_id: event.eventTypeId || null,
    final_library_id: normalizePositiveInteger(destination.libraryId),
    final_library_name: normalizeString(destination.libraryName) || null,
    route_result: {
      attempted: routeResult.attempted === true,
      succeeded: routeResult.succeeded === true,
      missing_mapping: routeResult.missingMapping === true,
      reason_code: normalizeString(routeResult.reasonCode, 80) || null,
    },
    final_outcome: source.finalOutcome || null,
    learning_guard: source.learningGuard || null,
    reason_codes: Array.isArray(source.reasonCodes) ? source.reasonCodes : [],
  };
}

const policyNativePendingRouteOutcomeService = Object.freeze({
  build: buildPolicyNativePendingRouteOutcome,
  audit: buildPolicyNativePendingRouteOutcomeAudit,
  toOutcomePatch: buildNativePendingRouteOutcomePatch,
});

export {
  POLICY_NATIVE_PENDING_ROUTE_OUTCOME_AUDIT_RISK_IDS,
  POLICY_NATIVE_PENDING_ROUTE_OUTCOME_REASON_IDS,
  POLICY_NATIVE_PENDING_ROUTE_OUTCOME_STATUS_IDS,
  POLICY_NATIVE_PENDING_ROUTE_OUTCOME_VERSION,
  buildNativePendingRouteOutcomePatch,
  buildPolicyNativePendingRouteOutcome,
  buildPolicyNativePendingRouteOutcomeAudit,
  policyNativePendingRouteOutcomeService,
};
