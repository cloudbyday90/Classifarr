import { createHash } from 'node:crypto';
import * as defaultDb from '../config/database.mjs';

const POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_VERSION = 'policy.library_metadata_evidence_collector.v1';
const MAX_LIBRARY_METADATA_EVIDENCE_RECORDS = 50;

const POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_STATUS_IDS = Object.freeze({
  READY: 'ready',
  INVALID_LIBRARY_ID: 'invalid_library_id',
  COLLECTION_FAILED: 'collection_failed',
});

const POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_RISK_IDS = Object.freeze({
  INVALID_LIBRARY_ID: 'invalid_library_id',
  COLLECTION_FAILED: 'collection_failed',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
  SUMMARY_COUNT_MISMATCH: 'summary_count_mismatch',
  INVALID_METADATA_FACT: 'invalid_metadata_fact',
});

const FINAL_METADATA_STATUS_IDS = Object.freeze([
  'completed',
  'corrected',
  'reclassified',
  'verified',
  'routed',
]);

const METADATA_GENRE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 &'/-]{0,79}$/;

const METADATA_GENRE_SQL = `
  SELECT
    MIN(BTRIM(genre_name)) AS genre_name,
    COUNT(*)::integer AS occurrence_count,
    MAX(COALESCE(ch.updated_at, ch.created_at)) AS observed_at
  FROM classification_history ch
  CROSS JOIN LATERAL UNNEST(COALESCE(ch.genre_names, ARRAY[]::text[])) AS genre_name
  WHERE ch.library_id = $1
    AND ch.status = ANY($2::text[])
    AND LENGTH(BTRIM(genre_name)) BETWEEN 1 AND 80
  GROUP BY LOWER(BTRIM(genre_name))
  ORDER BY occurrence_count DESC, LOWER(BTRIM(genre_name)) ASC
  LIMIT $3
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

function normalizeGenre(value) {
  if (typeof value !== 'string') return null;
  if (/[\u0000-\u001F\u007F]/.test(value)) return null;

  const genre = value.trim().replace(/\s+/g, ' ');
  return METADATA_GENRE_PATTERN.test(genre) ? genre : null;
}

function normalizeOccurrenceCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : null;
}

function buildMetadataGenreKey(genre) {
  const fingerprint = createHash('sha256')
    .update(genre.toLocaleLowerCase('en-US'))
    .digest('hex')
    .slice(0, 16);

  return `metadata_genre:${fingerprint}`;
}

function buildMetadataGenreEvidence(row = {}) {
  const record = asPlainObject(row);
  const genre = normalizeGenre(record.genre_name);
  const count = normalizeOccurrenceCount(record.occurrence_count);
  if (!genre || count === null) return null;

  return {
    key: buildMetadataGenreKey(genre),
    label: `Persisted metadata genre: ${genre}`,
    value: genre,
    count,
    confidence: null,
    observedAt: normalizeTimestamp(record.observed_at),
    reasonCode: 'persisted_metadata_genre_compatibility',
  };
}

function buildSideEffects({ databaseRead = false } = {}) {
  return {
    databaseRead,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
    policyStorageMutated: false,
    metadataRefreshPerformed: false,
  };
}

function buildCollectorResult({
  libraryId = null,
  statusId,
  ok,
  issue = null,
  metadataEvidence = [],
  metadataGenreRowsRead = 0,
  invalidMetadataGenreFactCount = 0,
  metadataGenresTruncated = false,
  databaseRead = false,
} = {}) {
  const issues = issue ? [issue] : [];

  return {
    version: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_VERSION,
    ok,
    statusId,
    libraryId,
    issueCount: issues.length,
    issues,
    metadataEvidence,
    summary: {
      maxRecords: MAX_LIBRARY_METADATA_EVIDENCE_RECORDS,
      metadataGenreRowsRead,
      metadataEvidenceCount: metadataEvidence.length,
      invalidMetadataGenreFactCount,
      metadataGenresTruncated,
    },
    sideEffects: buildSideEffects({ databaseRead }),
  };
}

function createPolicyLibraryMetadataEvidenceCollector({ db = defaultDb } = {}) {
  async function collectLibraryMetadataEvidence({ libraryId } = {}) {
    const normalizedLibraryId = normalizeLibraryId(libraryId);
    if (normalizedLibraryId === null) {
      return buildCollectorResult({
        statusId: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_STATUS_IDS.INVALID_LIBRARY_ID,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_RISK_IDS.INVALID_LIBRARY_ID,
          message: 'Metadata evidence requires a positive integer library ID.',
        },
      });
    }

    if (!db || typeof db.query !== 'function') {
      return buildCollectorResult({
        libraryId: normalizedLibraryId,
        statusId: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_STATUS_IDS.COLLECTION_FAILED,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_RISK_IDS.COLLECTION_FAILED,
          message: 'Persisted metadata evidence could not be collected.',
        },
      });
    }

    try {
      const boundedQueryLimit = MAX_LIBRARY_METADATA_EVIDENCE_RECORDS + 1;
      const result = await db.query(METADATA_GENRE_SQL, [
        normalizedLibraryId,
        FINAL_METADATA_STATUS_IDS,
        boundedQueryLimit,
      ]);
      const rows = asArray(result?.rows);
      const metadataGenresTruncated = rows.length > MAX_LIBRARY_METADATA_EVIDENCE_RECORDS;
      const normalizedEntries = rows
        .slice(0, MAX_LIBRARY_METADATA_EVIDENCE_RECORDS)
        .map(buildMetadataGenreEvidence);
      const metadataEvidence = normalizedEntries.filter(Boolean);
      const invalidMetadataGenreFactCount = normalizedEntries.length - metadataEvidence.length;

      return buildCollectorResult({
        libraryId: normalizedLibraryId,
        statusId: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_STATUS_IDS.READY,
        ok: true,
        metadataEvidence,
        metadataGenreRowsRead: rows.length,
        invalidMetadataGenreFactCount,
        metadataGenresTruncated,
        databaseRead: true,
      });
    } catch {
      return buildCollectorResult({
        libraryId: normalizedLibraryId,
        statusId: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_STATUS_IDS.COLLECTION_FAILED,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_RISK_IDS.COLLECTION_FAILED,
          message: 'Persisted metadata evidence could not be collected.',
        },
        databaseRead: true,
      });
    }
  }

  return {
    collectLibraryMetadataEvidence,
  };
}

function buildPolicyLibraryMetadataEvidenceCollectorAudit(result = {}) {
  const issues = [];
  const summary = asPlainObject(result.summary);
  const metadataEvidence = asArray(result.metadataEvidence);
  const rowsRead = Number(summary.metadataGenreRowsRead) || 0;
  const invalidFactCount = Number(summary.invalidMetadataGenreFactCount) || 0;

  if (result.ok === true && result.statusId !== POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_STATUS_IDS.READY) {
    issues.push({
      riskId: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_RISK_IDS.COLLECTION_FAILED,
      message: 'Ready metadata evidence must have a ready status.',
    });
  }

  if (summary.metadataEvidenceCount !== metadataEvidence.length ||
      metadataEvidence.length > MAX_LIBRARY_METADATA_EVIDENCE_RECORDS ||
      rowsRead < metadataEvidence.length + invalidFactCount ||
      summary.metadataGenresTruncated !== (rowsRead > MAX_LIBRARY_METADATA_EVIDENCE_RECORDS)) {
    issues.push({
      riskId: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_RISK_IDS.SUMMARY_COUNT_MISMATCH,
      message: 'Metadata evidence summary counts must match bounded returned records.',
    });
  }

  metadataEvidence.forEach(entry => {
    if (!normalizeGenre(entry?.value) || entry?.reasonCode !== 'persisted_metadata_genre_compatibility') {
      issues.push({
        riskId: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_RISK_IDS.INVALID_METADATA_FACT,
        message: 'Metadata evidence must contain a normalized persisted genre fact only.',
      });
    }
  });

  Object.entries(asPlainObject(result.sideEffects)).forEach(([sideEffectId, performed]) => {
    if (performed === true && sideEffectId !== 'databaseRead') {
      issues.push({
        riskId: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_RISK_IDS.UNSAFE_SIDE_EFFECT,
        message: 'Metadata evidence collection must not perform live lookups, quota reads, storage writes, or metadata refreshes.',
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

const policyLibraryMetadataEvidenceCollector = createPolicyLibraryMetadataEvidenceCollector();

export {
  FINAL_METADATA_STATUS_IDS,
  MAX_LIBRARY_METADATA_EVIDENCE_RECORDS,
  POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_RISK_IDS,
  POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_STATUS_IDS,
  POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_VERSION,
  buildPolicyLibraryMetadataEvidenceCollectorAudit,
  createPolicyLibraryMetadataEvidenceCollector,
  policyLibraryMetadataEvidenceCollector,
};
