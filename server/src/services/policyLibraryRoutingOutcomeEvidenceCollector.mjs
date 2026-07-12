import * as defaultDb from '../config/database.mjs';
import {
  buildPolicyLibraryEvidenceRecordCollectionAudit,
} from './policyLibraryEvidenceRecordContract.mjs';

const POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_VERSION = 'policy.library_routing_outcome_evidence_collector.v1';
const MAX_LIBRARY_ROUTING_OUTCOME_EVIDENCE_RECORDS = 50;

const POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS = Object.freeze({
  READY: 'ready',
  INVALID_LIBRARY_ID: 'invalid_library_id',
  COLLECTION_FAILED: 'collection_failed',
});

const POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS = Object.freeze({
  INVALID_LIBRARY_ID: 'invalid_library_id',
  COLLECTION_FAILED: 'collection_failed',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
  SUMMARY_COUNT_MISMATCH: 'summary_count_mismatch',
  UNKNOWN_OUTCOME_STATE: 'unknown_outcome_state',
});

const ROUTING_OUTCOME_STATE_IDS = Object.freeze({
  SUCCEEDED: 'succeeded',
  BLOCKED: 'blocked',
  SKIPPED: 'skipped',
});

const SUCCESSFUL_ROUTING_REASON_IDS = Object.freeze([
  'routed',
  'already_in_arr',
]);

const BLOCKED_ROUTING_REASON_IDS = Object.freeze([
  'no_mapping',
  'missing_arr_id',
  'unsupported_arr_type',
  'config_missing_or_inactive',
  'missing_required_settings',
  'missing_tvdb_id',
  'lookup_no_series',
  'lookup_missing_title',
  'arr_add_failed',
  'invalid_metadata',
  'unexpected_error',
]);

const SKIPPED_ROUTING_REASON_IDS = Object.freeze([
  'no_library',
  'not_final',
  'confirmation_required',
  'threshold_not_met',
]);

const ROUTING_OUTCOME_SQL = `
  SELECT
    ch.id,
    ch.created_at,
    ch.updated_at,
    CASE
      WHEN ch.status = 'routed'
        OR COALESCE(ch.metadata #>> '{classification_details,routing}', '') = ANY($2::text[])
        THEN '${ROUTING_OUTCOME_STATE_IDS.SUCCEEDED}'
      WHEN COALESCE(ch.metadata #>> '{classification_details,routing}', '') = ANY($3::text[])
        THEN '${ROUTING_OUTCOME_STATE_IDS.BLOCKED}'
      WHEN COALESCE(ch.metadata #>> '{classification_details,routing}', '') = ANY($4::text[])
        THEN '${ROUTING_OUTCOME_STATE_IDS.SKIPPED}'
      ELSE NULL
    END AS routing_outcome_state
  FROM classification_history ch
  WHERE ch.library_id = $1
    AND (
      ch.status = 'routed'
      OR COALESCE(ch.metadata #>> '{classification_details,routing}', '') = ANY($2::text[])
      OR COALESCE(ch.metadata #>> '{classification_details,routing}', '') = ANY($3::text[])
      OR COALESCE(ch.metadata #>> '{classification_details,routing}', '') = ANY($4::text[])
    )
  ORDER BY COALESCE(ch.updated_at, ch.created_at) DESC, ch.id DESC
  LIMIT $5
`;

const ROUTING_OUTCOME_EVIDENCE_DETAILS = Object.freeze({
  [ROUTING_OUTCOME_STATE_IDS.SUCCEEDED]: Object.freeze({
    label: 'Persisted successful Arr routing outcome',
    reasonCode: 'persisted_routing_succeeded',
  }),
  [ROUTING_OUTCOME_STATE_IDS.BLOCKED]: Object.freeze({
    label: 'Persisted blocked Arr routing outcome',
    reasonCode: 'persisted_routing_blocked',
  }),
  [ROUTING_OUTCOME_STATE_IDS.SKIPPED]: Object.freeze({
    label: 'Persisted skipped Arr routing outcome',
    reasonCode: 'persisted_routing_skipped',
  }),
});

const ROUTING_OUTCOME_REASON_CODES = Object.freeze(
  Object.values(ROUTING_OUTCOME_EVIDENCE_DETAILS).map(details => details.reasonCode)
);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeLibraryId(value) {
  const libraryId = Number(value);
  return Number.isInteger(libraryId) && libraryId > 0 ? libraryId : null;
}

function normalizeTimestamp(value) {
  if (!value) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function buildRoutingOutcomeEvidence(row = {}) {
  const record = asPlainObject(row);
  const classificationId = Number(record.id);
  const outcomeState = typeof record.routing_outcome_state === 'string'
    ? record.routing_outcome_state
    : null;
  const details = ROUTING_OUTCOME_EVIDENCE_DETAILS[outcomeState];
  if (!Number.isInteger(classificationId) || classificationId < 1 || !details) return null;

  return {
    key: `routing_outcome:classification:${classificationId}`,
    label: details.label,
    value: outcomeState,
    count: 1,
    confidence: null,
    observedAt: normalizeTimestamp(record.updated_at ?? record.created_at),
    reasonCode: details.reasonCode,
  };
}

function buildSideEffects({ databaseRead = false } = {}) {
  return {
    databaseRead,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
    policyStorageMutated: false,
    routeAttemptPerformed: false,
  };
}

function buildCollectorResult({
  libraryId = null,
  statusId,
  ok,
  issue = null,
  arrRoutingOutcomes = [],
  routingOutcomeRowsRead = 0,
  routingOutcomesTruncated = false,
  databaseRead = false,
} = {}) {
  const issues = issue ? [issue] : [];

  return {
    version: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_VERSION,
    ok,
    statusId,
    libraryId,
    issueCount: issues.length,
    issues,
    arrRoutingOutcomes,
    summary: {
      maxRecords: MAX_LIBRARY_ROUTING_OUTCOME_EVIDENCE_RECORDS,
      routingOutcomeRowsRead,
      routingOutcomeEvidenceCount: arrRoutingOutcomes.length,
      routingOutcomesTruncated,
    },
    sideEffects: buildSideEffects({ databaseRead }),
  };
}

function createPolicyLibraryRoutingOutcomeEvidenceCollector({ db = defaultDb } = {}) {
  async function collectLibraryRoutingOutcomeEvidence({ libraryId } = {}) {
    const normalizedLibraryId = normalizeLibraryId(libraryId);
    if (normalizedLibraryId === null) {
      return buildCollectorResult({
        statusId: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.INVALID_LIBRARY_ID,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.INVALID_LIBRARY_ID,
          message: 'Routing outcome evidence requires a positive integer library ID.',
        },
      });
    }

    if (!db || typeof db.query !== 'function') {
      return buildCollectorResult({
        libraryId: normalizedLibraryId,
        statusId: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.COLLECTION_FAILED,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.COLLECTION_FAILED,
          message: 'Persisted routing outcome evidence could not be collected.',
        },
      });
    }

    try {
      const boundedQueryLimit = MAX_LIBRARY_ROUTING_OUTCOME_EVIDENCE_RECORDS + 1;
      const result = await db.query(ROUTING_OUTCOME_SQL, [
        normalizedLibraryId,
        SUCCESSFUL_ROUTING_REASON_IDS,
        BLOCKED_ROUTING_REASON_IDS,
        SKIPPED_ROUTING_REASON_IDS,
        boundedQueryLimit,
      ]);
      const rows = asArray(result?.rows);
      const routingOutcomesTruncated = rows.length > MAX_LIBRARY_ROUTING_OUTCOME_EVIDENCE_RECORDS;
      const arrRoutingOutcomes = rows
        .slice(0, MAX_LIBRARY_ROUTING_OUTCOME_EVIDENCE_RECORDS)
        .map(buildRoutingOutcomeEvidence)
        .filter(Boolean);

      return buildCollectorResult({
        libraryId: normalizedLibraryId,
        statusId: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.READY,
        ok: true,
        arrRoutingOutcomes,
        routingOutcomeRowsRead: rows.length,
        routingOutcomesTruncated,
        databaseRead: true,
      });
    } catch {
      return buildCollectorResult({
        libraryId: normalizedLibraryId,
        statusId: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.COLLECTION_FAILED,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.COLLECTION_FAILED,
          message: 'Persisted routing outcome evidence could not be collected.',
        },
        databaseRead: true,
      });
    }
  }

  return {
    collectLibraryRoutingOutcomeEvidence,
  };
}

function buildPolicyLibraryRoutingOutcomeEvidenceCollectorAudit(result = {}) {
  const issues = [];
  const summary = asPlainObject(result.summary);
  const arrRoutingOutcomes = asArray(result.arrRoutingOutcomes);
  const recordAudit = buildPolicyLibraryEvidenceRecordCollectionAudit(
    arrRoutingOutcomes,
    { allowedReasonCodes: ROUTING_OUTCOME_REASON_CODES }
  );
  const rowsRead = Number(summary.routingOutcomeRowsRead) || 0;

  if (result.ok === true && result.statusId !== POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.READY) {
    issues.push({
      riskId: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.COLLECTION_FAILED,
      message: 'Ready routing outcome evidence must have a ready status.',
    });
  }

  if (summary.routingOutcomeEvidenceCount !== arrRoutingOutcomes.length ||
      arrRoutingOutcomes.length > MAX_LIBRARY_ROUTING_OUTCOME_EVIDENCE_RECORDS ||
      rowsRead < arrRoutingOutcomes.length ||
      summary.routingOutcomesTruncated !== (rowsRead > MAX_LIBRARY_ROUTING_OUTCOME_EVIDENCE_RECORDS)) {
    issues.push({
      riskId: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.SUMMARY_COUNT_MISMATCH,
      message: 'Routing outcome evidence summary counts must match bounded returned records.',
    });
  }

  issues.push(...recordAudit.issues);

  arrRoutingOutcomes.forEach(entry => {
    if (!ROUTING_OUTCOME_EVIDENCE_DETAILS[entry?.value]) {
      issues.push({
        riskId: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.UNKNOWN_OUTCOME_STATE,
        message: 'Routing outcome evidence must use a known normalized outcome state.',
      });
    }
  });

  Object.entries(asPlainObject(result.sideEffects)).forEach(([sideEffectId, performed]) => {
    if (performed === true && sideEffectId !== 'databaseRead') {
      issues.push({
        riskId: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.UNSAFE_SIDE_EFFECT,
        message: 'Routing outcome evidence collection must not perform live lookups, quota reads, storage writes, or route attempts.',
        sideEffectId,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

const policyLibraryRoutingOutcomeEvidenceCollector = createPolicyLibraryRoutingOutcomeEvidenceCollector();

export {
  BLOCKED_ROUTING_REASON_IDS,
  MAX_LIBRARY_ROUTING_OUTCOME_EVIDENCE_RECORDS,
  POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS,
  POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS,
  POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_VERSION,
  ROUTING_OUTCOME_STATE_IDS,
  ROUTING_OUTCOME_REASON_CODES,
  SKIPPED_ROUTING_REASON_IDS,
  SUCCESSFUL_ROUTING_REASON_IDS,
  buildPolicyLibraryRoutingOutcomeEvidenceCollectorAudit,
  createPolicyLibraryRoutingOutcomeEvidenceCollector,
  policyLibraryRoutingOutcomeEvidenceCollector,
};
