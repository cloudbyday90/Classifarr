import * as defaultDb from '../config/database.mjs';
import {
  buildPolicyLibraryEvidenceRecordCollectionAudit,
} from './policyLibraryEvidenceRecordContract.mjs';

const POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_VERSION = 'policy.library_outcome_evidence_collector.v1';
const MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS = 50;

const POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS = Object.freeze({
  READY: 'ready',
  INVALID_LIBRARY_ID: 'invalid_library_id',
  COLLECTION_FAILED: 'collection_failed',
});

const POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS = Object.freeze({
  INVALID_LIBRARY_ID: 'invalid_library_id',
  COLLECTION_FAILED: 'collection_failed',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
  SUMMARY_COUNT_MISMATCH: 'summary_count_mismatch',
});

const FINAL_CLASSIFICATION_STATUS_IDS = Object.freeze([
  'completed',
  'corrected',
  'verified',
  'reclassified',
  'routed',
]);

const FINAL_OUTCOME_REASON_CODES = Object.freeze([
  'persisted_final_outcome',
]);

const MANUAL_CORRECTION_REASON_CODES = Object.freeze([
  'persisted_manual_correction',
]);

const FINAL_OUTCOME_SQL = `
  SELECT
    ch.id,
    ch.status,
    ch.confidence,
    ch.created_at,
    ch.updated_at
  FROM classification_history ch
  WHERE ch.library_id = $1
    AND ch.status = ANY($2::text[])
  ORDER BY COALESCE(ch.updated_at, ch.created_at) DESC, ch.id DESC
  LIMIT $3
`;

const MANUAL_CORRECTION_SQL = `
  SELECT
    cc.id,
    cc.classification_id,
    cc.corrected_library_id,
    cc.created_at
  FROM classification_corrections cc
  WHERE cc.corrected_library_id = $1
  ORDER BY cc.created_at DESC, cc.id DESC
  LIMIT $2
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

function normalizeConfidence(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return null;

  return confidence > 1
    ? Math.max(0, Math.min(1, confidence / 100))
    : Math.max(0, Math.min(1, confidence));
}

function buildFinalOutcomeEvidence(row = {}) {
  const record = asPlainObject(row);
  const classificationId = Number(record.id);
  if (!Number.isInteger(classificationId) || classificationId < 1) return null;

  return {
    key: `classification:${classificationId}`,
    label: 'Persisted final classification outcome',
    value: typeof record.status === 'string' ? record.status : null,
    count: 1,
    confidence: normalizeConfidence(record.confidence),
    observedAt: normalizeTimestamp(record.updated_at ?? record.created_at),
    reasonCode: 'persisted_final_outcome',
  };
}

function buildManualCorrectionEvidence(row = {}) {
  const record = asPlainObject(row);
  const correctionId = Number(record.id);
  const classificationId = Number(record.classification_id);
  if (!Number.isInteger(correctionId) || correctionId < 1 ||
      !Number.isInteger(classificationId) || classificationId < 1) {
    return null;
  }

  return {
    key: `correction:${correctionId}:classification:${classificationId}`,
    label: 'Persisted manual correction to this destination',
    value: null,
    count: 1,
    confidence: null,
    observedAt: normalizeTimestamp(record.created_at),
    reasonCode: 'persisted_manual_correction',
  };
}

function buildSideEffects({ databaseRead = false } = {}) {
  return {
    databaseRead,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
    policyStorageMutated: false,
  };
}

function buildCollectorResult({
  libraryId = null,
  statusId,
  ok,
  issue = null,
  classificationOutcomes = [],
  manualCorrections = [],
  finalOutcomeRowsRead = 0,
  manualCorrectionRowsRead = 0,
  finalOutcomesTruncated = false,
  manualCorrectionsTruncated = false,
  databaseRead = false,
} = {}) {
  const issues = issue ? [issue] : [];

  return {
    version: POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_VERSION,
    ok,
    statusId,
    libraryId,
    issueCount: issues.length,
    issues,
    classificationOutcomes,
    manualCorrections,
    summary: {
      maxRecordsPerSection: MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS,
      finalOutcomeRowsRead,
      finalOutcomeEvidenceCount: classificationOutcomes.length,
      finalOutcomesTruncated,
      manualCorrectionRowsRead,
      manualCorrectionEvidenceCount: manualCorrections.length,
      manualCorrectionsTruncated,
    },
    sideEffects: buildSideEffects({ databaseRead }),
  };
}

function createPolicyLibraryOutcomeEvidenceCollector({ db = defaultDb } = {}) {
  async function collectLibraryOutcomeEvidence({ libraryId } = {}) {
    const normalizedLibraryId = normalizeLibraryId(libraryId);
    if (normalizedLibraryId === null) {
      return buildCollectorResult({
        statusId: POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.INVALID_LIBRARY_ID,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.INVALID_LIBRARY_ID,
          message: 'Library outcome evidence requires a positive integer library ID.',
        },
      });
    }

    if (!db || typeof db.query !== 'function') {
      return buildCollectorResult({
        libraryId: normalizedLibraryId,
        statusId: POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.COLLECTION_FAILED,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.COLLECTION_FAILED,
          message: 'Persisted outcome evidence could not be collected.',
        },
      });
    }

    try {
      const boundedQueryLimit = MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS + 1;
      const [finalOutcomeResult, manualCorrectionResult] = await Promise.all([
        db.query(FINAL_OUTCOME_SQL, [
          normalizedLibraryId,
          FINAL_CLASSIFICATION_STATUS_IDS,
          boundedQueryLimit,
        ]),
        db.query(MANUAL_CORRECTION_SQL, [normalizedLibraryId, boundedQueryLimit]),
      ]);
      const finalOutcomeRows = asArray(finalOutcomeResult?.rows);
      const manualCorrectionRows = asArray(manualCorrectionResult?.rows);
      const finalOutcomesTruncated = finalOutcomeRows.length > MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS;
      const manualCorrectionsTruncated = manualCorrectionRows.length > MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS;
      const classificationOutcomes = finalOutcomeRows
        .slice(0, MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS)
        .map(buildFinalOutcomeEvidence)
        .filter(Boolean);
      const manualCorrections = manualCorrectionRows
        .slice(0, MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS)
        .map(buildManualCorrectionEvidence)
        .filter(Boolean);

      return buildCollectorResult({
        libraryId: normalizedLibraryId,
        statusId: POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.READY,
        ok: true,
        classificationOutcomes,
        manualCorrections,
        finalOutcomeRowsRead: finalOutcomeRows.length,
        manualCorrectionRowsRead: manualCorrectionRows.length,
        finalOutcomesTruncated,
        manualCorrectionsTruncated,
        databaseRead: true,
      });
    } catch {
      return buildCollectorResult({
        libraryId: normalizedLibraryId,
        statusId: POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.COLLECTION_FAILED,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.COLLECTION_FAILED,
          message: 'Persisted outcome evidence could not be collected.',
        },
        databaseRead: true,
      });
    }
  }

  return {
    collectLibraryOutcomeEvidence,
  };
}

function buildPolicyLibraryOutcomeEvidenceCollectorAudit(result = {}) {
  const issues = [];
  const summary = asPlainObject(result.summary);
  const classificationOutcomes = asArray(result.classificationOutcomes);
  const manualCorrections = asArray(result.manualCorrections);
  const finalOutcomeRecordAudit = buildPolicyLibraryEvidenceRecordCollectionAudit(
    classificationOutcomes,
    { allowedReasonCodes: FINAL_OUTCOME_REASON_CODES }
  );
  const manualCorrectionRecordAudit = buildPolicyLibraryEvidenceRecordCollectionAudit(
    manualCorrections,
    { allowedReasonCodes: MANUAL_CORRECTION_REASON_CODES }
  );

  if (result.ok === true && result.statusId !== POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.READY) {
    issues.push({
      riskId: POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.COLLECTION_FAILED,
      message: 'Ready outcome evidence must have a ready status.',
    });
  }

  if (summary.finalOutcomeEvidenceCount !== classificationOutcomes.length ||
      summary.manualCorrectionEvidenceCount !== manualCorrections.length ||
      classificationOutcomes.length > MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS ||
      manualCorrections.length > MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS) {
    issues.push({
      riskId: POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.SUMMARY_COUNT_MISMATCH,
      message: 'Outcome evidence summary counts must match bounded returned records.',
    });
  }

  issues.push(...finalOutcomeRecordAudit.issues, ...manualCorrectionRecordAudit.issues);

  Object.entries(asPlainObject(result.sideEffects)).forEach(([sideEffectId, performed]) => {
    if (performed === true && sideEffectId !== 'databaseRead') {
      issues.push({
        riskId: POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.UNSAFE_SIDE_EFFECT,
        message: 'Outcome evidence collection must not perform live lookups, quota reads, or storage writes.',
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

const policyLibraryOutcomeEvidenceCollector = createPolicyLibraryOutcomeEvidenceCollector();

export {
  FINAL_CLASSIFICATION_STATUS_IDS,
  FINAL_OUTCOME_REASON_CODES,
  MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS,
  MANUAL_CORRECTION_REASON_CODES,
  POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS,
  POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS,
  POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_VERSION,
  buildPolicyLibraryOutcomeEvidenceCollectorAudit,
  createPolicyLibraryOutcomeEvidenceCollector,
  policyLibraryOutcomeEvidenceCollector,
};
