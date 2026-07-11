const POLICY_REQUEST_TIME_EVENT_VERSION = 'policy.request_time_event.v1';

const POLICY_REQUEST_EVENT_TYPE_IDS = Object.freeze({
  USER_REQUESTED_DESTINATION: 'user_requested_destination',
  OPERATOR_MANUAL_DESTINATION_CHANGE: 'operator_manual_destination_change',
  ROUTE_SUCCEEDED: 'route_succeeded',
  ROUTE_FAILED_MISSING_MAPPING: 'route_failed_missing_mapping',
});

const POLICY_REQUEST_TIME_EVENT_FIELDS = new Set([
  'version',
  'eventTypeId',
  'item',
  'requestedDestination',
  'operatorDestination',
  'finalDestination',
  'routeResult',
  'answerOutcomeId',
  'answer',
  'candidate',
  'learningContext',
  'actorId',
  'sourceEventId',
]);

const POLICY_REQUEST_TIME_EVENT_RECORD_FIELDS = Object.freeze([
  'item',
  'requestedDestination',
  'operatorDestination',
  'finalDestination',
  'routeResult',
  'answer',
  'candidate',
  'learningContext',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asObject(value) {
  return isRecord(value) ? value : {};
}

function asCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDestination(value = {}) {
  const destination = asObject(value);

  return {
    libraryId: destination.libraryId ?? destination.destinationLibraryId ?? null,
    libraryName: normalizeString(destination.libraryName ?? destination.destinationLibraryName ?? destination.name),
    arrType: normalizeString(destination.arrType ?? destination.arr_type),
    arrConfigId: destination.arrConfigId ?? destination.arr_config_id ?? null,
    arrRootFolderPath: normalizeString(destination.arrRootFolderPath ?? destination.arr_root_folder_path),
  };
}

function normalizeItem(value = {}) {
  const item = asObject(value);

  return {
    itemId: item.itemId ?? item.id ?? item.tmdbId ?? null,
    title: normalizeString(item.title ?? item.name),
    year: item.year ?? null,
    mediaType: normalizeString(item.mediaType ?? item.media_type),
    tmdbId: item.tmdbId ?? item.tmdb_id ?? null,
  };
}

function normalizeRouteResult(value = {}, eventTypeId) {
  const route = asObject(value);
  const failedByEvent = eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING;
  const succeededByEvent = eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED;

  return {
    attempted: route.attempted === true || failedByEvent || succeededByEvent,
    succeeded: route.succeeded === true || succeededByEvent,
    missingMapping: route.missingMapping === true || route.reasonCode === 'missing_mapping' || failedByEvent,
    routeId: route.routeId ?? null,
    reasonCode: normalizeString(route.reasonCode) || (failedByEvent ? 'missing_mapping' : null),
  };
}

function normalizeAnswer(value = {}) {
  const answer = asObject(value);

  return {
    label: normalizeString(answer.label),
    destinationLibraryId: answer.destinationLibraryId ?? answer.libraryId ?? null,
    destinationLibraryName: normalizeString(answer.destinationLibraryName ?? answer.libraryName),
    ambiguous: answer.ambiguous === true,
  };
}

function normalizeCandidate(value = {}) {
  const candidate = asObject(value);

  return {
    key: normalizeString(candidate.key),
    label: normalizeString(candidate.label ?? candidate.value),
    signalType: normalizeString(candidate.signalType ?? candidate.signal_type),
    destinationLibraryId: candidate.destinationLibraryId ?? candidate.libraryId ?? null,
    destinationLibraryName: normalizeString(candidate.destinationLibraryName ?? candidate.libraryName),
    evidenceCount: asCount(candidate.evidenceCount ?? candidate.count ?? candidate.supportingExampleCount),
    evidenceSource: normalizeString(candidate.evidenceSource),
  };
}

function normalizeLearningContext(value = {}) {
  const context = asObject(value);

  return {
    aiExplanationText: normalizeString(context.aiExplanationText),
    aiAuthored: context.aiAuthored === true,
    providerQuotaState: normalizeString(context.providerQuotaState),
    providerCooldownState: normalizeString(context.providerCooldownState),
    replayDiagnosticState: normalizeString(context.replayDiagnosticState),
    tmdbDiagnosticState: normalizeString(context.tmdbDiagnosticState),
    tmdbCoverageState: normalizeString(context.tmdbCoverageState),
  };
}

function buildPolicyRequestTimeEvent(input = {}) {
  const rawInput = asObject(input);
  const eventTypeId = normalizeString(rawInput.eventTypeId) ||
    POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION;

  return {
    version: POLICY_REQUEST_TIME_EVENT_VERSION,
    eventTypeId,
    item: normalizeItem(rawInput.item),
    requestedDestination: normalizeDestination(rawInput.requestedDestination || rawInput.destination),
    operatorDestination: normalizeDestination(rawInput.operatorDestination || rawInput.destination),
    finalDestination: normalizeDestination(rawInput.finalDestination || rawInput.destination),
    routeResult: normalizeRouteResult(rawInput.routeResult, eventTypeId),
    answerOutcomeId: normalizeString(rawInput.answerOutcomeId) || null,
    answer: normalizeAnswer(rawInput.answer),
    candidate: normalizeCandidate(rawInput.candidate),
    learningContext: normalizeLearningContext(rawInput.context),
    actorId: normalizeString(rawInput.actorId) || null,
    sourceEventId: normalizeString(rawInput.sourceEventId) || null,
  };
}

function validatePolicyRequestTimeEvent(event = {}) {
  const requestEvent = asObject(event);
  const issues = [];

  for (const field of Object.keys(requestEvent)) {
    if (!POLICY_REQUEST_TIME_EVENT_FIELDS.has(field)) {
      issues.push({
        field,
        message: 'Request-time event contains an unsupported field.',
      });
    }
  }

  if (requestEvent.version !== POLICY_REQUEST_TIME_EVENT_VERSION) {
    issues.push({
      field: 'version',
      message: 'Request-time event must use the current event contract version.',
    });
  }

  if (!Object.values(POLICY_REQUEST_EVENT_TYPE_IDS).includes(requestEvent.eventTypeId)) {
    issues.push({
      field: 'eventTypeId',
      message: 'Request-time event must use a supported event type.',
    });
  }

  for (const field of POLICY_REQUEST_TIME_EVENT_RECORD_FIELDS) {
    if (!isRecord(requestEvent[field])) {
      issues.push({
        field,
        message: 'Request-time event must contain normalized record fields.',
      });
    }
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_REQUEST_EVENT_TYPE_IDS,
  POLICY_REQUEST_TIME_EVENT_VERSION,
  buildPolicyRequestTimeEvent,
  validatePolicyRequestTimeEvent,
};
