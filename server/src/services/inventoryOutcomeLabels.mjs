/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { AUTHORIZED_OUTCOME_EVALUATION_SQL, authorizedCorrectionSnapshotExists } from './authorizedOutcomeEvaluationQuery.mjs';
import { prepareAuthorizedOutcomeEvaluationRows, validateAuthorizedOutcomeEvaluationRow } from './authorizedOutcomeEvaluationSnapshot.mjs';

export const INVENTORY_OUTCOME_LABEL_LIMIT = 5000;

/** Read only explicit operator feedback/corrections; never use successful auto-routes as labels. */
export const INVENTORY_OUTCOME_LABEL_SQL = `
  SELECT media_type, tmdb_id, identity_key, selected_library_id, was_correction, origin, observed_at,
    classification_id, decision_context, target_available, authorized_snapshot
  FROM (
    SELECT media_type, tmdb_id, NULL::text AS identity_key, selected_library_id, was_correction,
      'feedback'::text AS origin, responded_at AS observed_at, id AS source_id,
      NULL::bigint AS classification_id, NULL::jsonb AS decision_context,
      NULL::boolean AS target_available, NULL::jsonb AS authorized_snapshot
    FROM policy_feedback_evaluation
    WHERE evaluation_correct IS NOT NULL
      AND responded_at IS NOT NULL AND isfinite(responded_at) AND responded_at <= NOW()
      AND media_type IN ('movie', 'tv')
    UNION ALL
    SELECT o.media_type, CASE WHEN o.identity_key LIKE 'source:%' THEN NULL
      ELSE split_part(o.identity_key, ':', 2)::integer END AS tmdb_id,
      o.identity_key, o.selected_library_id, true,
      'manual_correction'::text AS origin, o.observed_at, o.correction_id AS source_id,
      NULL::bigint, NULL::jsonb,
      (destination.is_active IS TRUE AND destination.media_type = o.media_type), NULL::jsonb
    FROM classification_correction_outcomes o
    LEFT JOIN libraries destination ON destination.id = o.selected_library_id
    WHERE o.observed_at > NOW() - INTERVAL '30 days' AND o.observed_at <= NOW()
      AND NOT ${authorizedCorrectionSnapshotExists('o.correction_id')}
    UNION ALL
    SELECT ch.media_type, ch.tmdb_id, NULL::text AS identity_key, cc.corrected_library_id, true AS was_correction,
      'manual_correction'::text AS origin, cc.created_at AT TIME ZONE current_setting('TimeZone') AS observed_at,
      cc.id AS source_id, NULL::bigint, NULL::jsonb,
      (destination.is_active IS TRUE AND destination.media_type = ch.media_type), NULL::jsonb
    FROM classification_corrections cc
    JOIN classification_history ch ON ch.id = cc.classification_id
      AND ch.library_id = cc.corrected_library_id AND ch.status IN ('corrected', 'reclassified')
    LEFT JOIN libraries destination ON destination.id = cc.corrected_library_id
    WHERE ch.media_type IN ('movie', 'tv') AND ch.tmdb_id > 0
      AND cc.original_library_id IS DISTINCT FROM cc.corrected_library_id
      AND cc.corrected_by IS NOT NULL AND btrim(cc.corrected_by) <> ''
      AND cc.created_at IS NOT NULL AND isfinite(cc.created_at)
      AND cc.created_at <= CURRENT_TIMESTAMP::timestamp
      AND cc.created_at > CURRENT_TIMESTAMP::timestamp - INTERVAL '30 days'
      AND NOT EXISTS (SELECT 1 FROM classification_correction_outcomes o WHERE o.correction_id = cc.id)
      AND NOT ${authorizedCorrectionSnapshotExists('cc.id')}
    UNION ALL
    SELECT * FROM (${AUTHORIZED_OUTCOME_EVALUATION_SQL}) authorized_rows
  ) explicit_outcomes
  ORDER BY observed_at DESC, source_id DESC, origin
  LIMIT 5001
`;

/** Conflicting selections for one typed identity are excluded instead of voting or guessing. */
export function prepareInventoryOutcomeLabels(rows, documents, libraries) {
  if (!Array.isArray(rows) || rows.length > INVENTORY_OUTCOME_LABEL_LIMIT) throw new Error('inventory_outcome_label_budget');
  rows = prepareAuthorizedOutcomeEvaluationRows(rows);
  const known = new Map(documents.map(doc => [doc.key, doc]));
  const active = new Map(libraries.map(library => [library.id, library.media_type]));
  const groups = new Map();
  const coverage = { eligibleRows: rows.length, invalidRows: 0, withoutInventoryDescription: 0,
    absentFromCurrentInventory: 0, conflictingIdentities: 0, labeledIdentities: 0,
    confirmations: 0, corrections: 0, manualCorrectionRows: 0, unavailableIdentities: 0,
    authorizedMissingSnapshotRows: 0, authorizedConfirmationRows: 0, authorizedCorrectionRows: 0 };
  for (const row of rows) {
    if (row?.origin === 'authorized_outcome') {
      if (row.authorized_snapshot.snapshot_missing) { coverage.authorizedMissingSnapshotRows++; coverage.eligibleRows--; continue; }
      coverage[row.was_correction ? 'authorizedCorrectionRows' : 'authorizedConfirmationRows']++;
    }
    coverage.manualCorrectionRows += Number(row?.origin === 'manual_correction');
    const type = row?.media_type, destination = row?.selected_library_id;
    const key = inventoryOutcomeIdentity(row);
    if (!['movie', 'tv'].includes(type) || !key ||
        !Number.isInteger(destination) ||
        typeof row.was_correction !== 'boolean') { coverage.invalidRows++; continue; }
    const doc = known.get(key);
    if (!doc) { coverage.withoutInventoryDescription++; continue; }
    // A correction can precede a move/sync. Membership is coverage, not label authority.
    if (!doc.libraryIds.includes(destination)) coverage.absentFromCurrentInventory++;
    if (!groups.has(key)) groups.set(key, { doc, destinations: new Set(), correction: false, unavailable: false, conflict: false });
    const group = groups.get(key);
    group.destinations.add(destination);
    group.correction ||= row.was_correction;
    group.unavailable ||= active.get(destination) !== type || row.target_available === false;
    group.conflict ||= row.evidence_conflict === true;
  }
  const labels = new Map();
  for (const [key, group] of groups) {
    if (group.destinations.size !== 1 || group.conflict) { coverage.conflictingIdentities++; continue; }
    if (group.unavailable) { coverage.unavailableIdentities++; continue; }
    const libraryId = [...group.destinations][0];
    labels.set(key, { libraryId, kind: group.correction ? 'correction' : 'confirmation' });
    coverage[group.correction ? 'corrections' : 'confirmations']++;
  }
  coverage.labeledIdentities = labels.size;
  return { labels, coverage };
}

export function inventoryOutcomeIdentity(row) {
  if (row?.origin === 'authorized_outcome') {
    validateAuthorizedOutcomeEvaluationRow(row);
    if (row.authorized_snapshot.snapshot_missing) return null;
  }
  const type = row?.media_type, key = row?.identity_key;
  if (key == null) return Number.isInteger(row?.tmdb_id) && row.tmdb_id > 0 ? `${type}:${row.tmdb_id}` : null;
  if (typeof key !== 'string' || !['manual_correction', 'authorized_outcome'].includes(row?.origin)) return null;
  if (/^source:[a-f0-9]{64}$/.test(key)) return row.tmdb_id == null ? key : null;
  const [keyType, rawId] = key.split(':');
  const id = Number(rawId);
  return keyType === type && id === row.tmdb_id && Number.isInteger(id) && id > 0 && id <= 2147483647 && key === `${type}:${id}` ? key : null;
}
