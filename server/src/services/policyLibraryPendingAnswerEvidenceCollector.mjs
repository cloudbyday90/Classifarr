import * as defaultDb from '../config/database.mjs';
import {
  buildPolicyLibraryEvidenceRecordCollectionAudit,
} from './policyLibraryEvidenceRecordContract.mjs';

const POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_VERSION = 'policy.library_pending_answer_evidence_collector.v1';
const MAX_LIBRARY_PENDING_ANSWER_EVIDENCE_RECORDS = 50;

const POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_STATUS_IDS = Object.freeze({
  READY: 'ready',
  INVALID_LIBRARY_ID: 'invalid_library_id',
  COLLECTION_FAILED: 'collection_failed',
});

const POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_RISK_IDS = Object.freeze({
  INVALID_LIBRARY_ID: 'invalid_library_id',
  COLLECTION_FAILED: 'collection_failed',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
  SUMMARY_COUNT_MISMATCH: 'summary_count_mismatch',
});

const RESOLVED_PENDING_ANSWER_STATUS_IDS = Object.freeze([
  'completed',
  'corrected',
  'reclassified',
  'verified',
  'routed',
]);

const PENDING_ANSWER_REASON_CODES = Object.freeze([
  'persisted_pending_answer_requires_learning_guard',
]);

const POLICY_QUESTION_RESOLUTION_TRANSITION = JSON.stringify([
  { type: 'resolved', source: 'policy_question' },
]);

const RESOLVED_PENDING_ANSWER_SQL = `
  SELECT
    ch.id,
    ch.created_at,
    ch.updated_at
  FROM classification_history ch
  WHERE ch.library_id = $1
    AND ch.status = ANY($2::text[])
    AND (
      COALESCE(
        ch.metadata #> '{classification_details,outcome_path,transitions}',
        '[]'::jsonb
      ) @> $3::jsonb
      OR (
        ch.clarification_status = 'resolved'
        AND ch.clarification_response IS NOT NULL
      )
    )
  ORDER BY COALESCE(ch.updated_at, ch.created_at) DESC, ch.id DESC
  LIMIT $4
`;

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

function buildPendingItemAnswerEvidence(row = {}) {
  const record = asPlainObject(row);
  const classificationId = Number(record.id);
  if (!Number.isInteger(classificationId) || classificationId < 1) return null;

  return {
    key: `pending_answer:classification:${classificationId}`,
    label: 'Persisted resolved pending-item answer',
    value: 'resolved',
    count: 1,
    confidence: null,
    observedAt: normalizeTimestamp(record.updated_at ?? record.created_at),
    reasonCode: 'persisted_pending_answer_requires_learning_guard',
  };
}

function buildSideEffects({ databaseRead = false } = {}) {
  return {
    databaseRead,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
    policyStorageMutated: false,
    learningMutationPerformed: false,
  };
}

function buildCollectorResult({
  libraryId = null,
  statusId,
  ok,
  issue = null,
  pendingItemAnswers = [],
  resolvedAnswerRowsRead = 0,
  resolvedAnswersTruncated = false,
  databaseRead = false,
} = {}) {
  const issues = issue ? [issue] : [];

  return {
    version: POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_VERSION,
    ok,
    statusId,
    libraryId,
    issueCount: issues.length,
    issues,
    pendingItemAnswers,
    summary: {
      maxRecords: MAX_LIBRARY_PENDING_ANSWER_EVIDENCE_RECORDS,
      resolvedAnswerRowsRead,
      pendingItemAnswerEvidenceCount: pendingItemAnswers.length,
      resolvedAnswersTruncated,
    },
    sideEffects: buildSideEffects({ databaseRead }),
  };
}

function createPolicyLibraryPendingAnswerEvidenceCollector({ db = defaultDb } = {}) {
  async function collectLibraryPendingAnswerEvidence({ libraryId } = {}) {
    const normalizedLibraryId = normalizeLibraryId(libraryId);
    if (normalizedLibraryId === null) {
      return buildCollectorResult({
        statusId: POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_STATUS_IDS.INVALID_LIBRARY_ID,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_RISK_IDS.INVALID_LIBRARY_ID,
          message: 'Pending-item answer evidence requires a positive integer library ID.',
        },
      });
    }

    if (!db || typeof db.query !== 'function') {
      return buildCollectorResult({
        libraryId: normalizedLibraryId,
        statusId: POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_STATUS_IDS.COLLECTION_FAILED,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_RISK_IDS.COLLECTION_FAILED,
          message: 'Persisted pending-item answer evidence could not be collected.',
        },
      });
    }

    try {
      const boundedQueryLimit = MAX_LIBRARY_PENDING_ANSWER_EVIDENCE_RECORDS + 1;
      const result = await db.query(RESOLVED_PENDING_ANSWER_SQL, [
        normalizedLibraryId,
        RESOLVED_PENDING_ANSWER_STATUS_IDS,
        POLICY_QUESTION_RESOLUTION_TRANSITION,
        boundedQueryLimit,
      ]);
      const rows = asArray(result?.rows);
      const resolvedAnswersTruncated = rows.length > MAX_LIBRARY_PENDING_ANSWER_EVIDENCE_RECORDS;
      const pendingItemAnswers = rows
        .slice(0, MAX_LIBRARY_PENDING_ANSWER_EVIDENCE_RECORDS)
        .map(buildPendingItemAnswerEvidence)
        .filter(Boolean);

      return buildCollectorResult({
        libraryId: normalizedLibraryId,
        statusId: POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_STATUS_IDS.READY,
        ok: true,
        pendingItemAnswers,
        resolvedAnswerRowsRead: rows.length,
        resolvedAnswersTruncated,
        databaseRead: true,
      });
    } catch {
      return buildCollectorResult({
        libraryId: normalizedLibraryId,
        statusId: POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_STATUS_IDS.COLLECTION_FAILED,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_RISK_IDS.COLLECTION_FAILED,
          message: 'Persisted pending-item answer evidence could not be collected.',
        },
        databaseRead: true,
      });
    }
  }

  return {
    collectLibraryPendingAnswerEvidence,
  };
}

function buildPolicyLibraryPendingAnswerEvidenceCollectorAudit(result = {}) {
  const issues = [];
  const summary = asPlainObject(result.summary);
  const pendingItemAnswers = asArray(result.pendingItemAnswers);
  const resolvedAnswerRowsRead = Number(summary.resolvedAnswerRowsRead) || 0;
  const recordAudit = buildPolicyLibraryEvidenceRecordCollectionAudit(
    pendingItemAnswers,
    { allowedReasonCodes: PENDING_ANSWER_REASON_CODES }
  );

  if (result.ok === true && result.statusId !== POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_STATUS_IDS.READY) {
    issues.push({
      riskId: POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_RISK_IDS.COLLECTION_FAILED,
      message: 'Ready pending-item answer evidence must have a ready status.',
    });
  }

  if (summary.pendingItemAnswerEvidenceCount !== pendingItemAnswers.length ||
      pendingItemAnswers.length > MAX_LIBRARY_PENDING_ANSWER_EVIDENCE_RECORDS ||
      resolvedAnswerRowsRead < pendingItemAnswers.length ||
      summary.resolvedAnswersTruncated !==
        (resolvedAnswerRowsRead > MAX_LIBRARY_PENDING_ANSWER_EVIDENCE_RECORDS)) {
    issues.push({
      riskId: POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_RISK_IDS.SUMMARY_COUNT_MISMATCH,
      message: 'Pending-item answer evidence summary counts must match bounded returned records.',
    });
  }

  issues.push(...recordAudit.issues);

  Object.entries(asPlainObject(result.sideEffects)).forEach(([sideEffectId, performed]) => {
    if (performed === true && sideEffectId !== 'databaseRead') {
      issues.push({
        riskId: POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_RISK_IDS.UNSAFE_SIDE_EFFECT,
        message: 'Pending-item answer evidence collection must not perform live lookups, quota reads, storage writes, or learning mutations.',
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

const policyLibraryPendingAnswerEvidenceCollector = createPolicyLibraryPendingAnswerEvidenceCollector();

export {
  MAX_LIBRARY_PENDING_ANSWER_EVIDENCE_RECORDS,
  PENDING_ANSWER_REASON_CODES,
  POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_RISK_IDS,
  POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_STATUS_IDS,
  POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_VERSION,
  POLICY_QUESTION_RESOLUTION_TRANSITION,
  RESOLVED_PENDING_ANSWER_STATUS_IDS,
  buildPolicyLibraryPendingAnswerEvidenceCollectorAudit,
  createPolicyLibraryPendingAnswerEvidenceCollector,
  policyLibraryPendingAnswerEvidenceCollector,
};
