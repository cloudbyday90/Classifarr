/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const INVENTORY_OUTCOME_LABEL_LIMIT = 5000;

/** Read only explicit operator feedback/corrections; never use successful auto-routes as labels. */
export const INVENTORY_OUTCOME_LABEL_SQL = `
  SELECT media_type, tmdb_id, selected_library_id, was_correction, origin, observed_at
  FROM (
    SELECT media_type, tmdb_id, selected_library_id, was_correction,
      'feedback'::text AS origin, responded_at AS observed_at, id AS source_id
    FROM policy_feedback_evaluation
    WHERE evaluation_correct IS NOT NULL
      AND responded_at IS NOT NULL AND isfinite(responded_at) AND responded_at <= NOW()
      AND media_type IN ('movie', 'tv')
    UNION ALL
    SELECT ch.media_type, ch.tmdb_id, cc.corrected_library_id, true AS was_correction,
      'manual_correction'::text AS origin, cc.created_at AT TIME ZONE current_setting('TimeZone') AS observed_at,
      cc.id AS source_id
    FROM classification_corrections cc
    JOIN classification_history ch ON ch.id = cc.classification_id
      AND ch.library_id = cc.corrected_library_id AND ch.status IN ('corrected', 'reclassified')
    JOIN libraries destination ON destination.id = cc.corrected_library_id
      AND destination.is_active IS TRUE AND destination.media_type = ch.media_type
    WHERE ch.media_type IN ('movie', 'tv') AND ch.tmdb_id > 0
      AND cc.original_library_id IS DISTINCT FROM cc.corrected_library_id
      AND cc.corrected_by IS NOT NULL AND btrim(cc.corrected_by) <> ''
      AND cc.created_at IS NOT NULL AND isfinite(cc.created_at)
      AND cc.created_at <= CURRENT_TIMESTAMP::timestamp
  ) explicit_outcomes
  ORDER BY observed_at DESC, source_id DESC
  LIMIT 5001
`;

/** Conflicting selections for one typed identity are excluded instead of voting or guessing. */
export function prepareInventoryOutcomeLabels(rows, documents, libraries) {
  if (!Array.isArray(rows) || rows.length > INVENTORY_OUTCOME_LABEL_LIMIT) throw new Error('inventory_outcome_label_budget');
  const known = new Map(documents.map(doc => [doc.key, doc]));
  const active = new Map(libraries.map(library => [library.id, library.media_type]));
  const groups = new Map();
  const coverage = { eligibleRows: rows.length, invalidRows: 0, withoutInventoryDescription: 0,
    absentFromCurrentInventory: 0, conflictingIdentities: 0, labeledIdentities: 0,
    confirmations: 0, corrections: 0, manualCorrectionRows: 0 };
  for (const row of rows) {
    coverage.manualCorrectionRows += Number(row?.origin === 'manual_correction');
    const type = row?.media_type, id = row?.tmdb_id, destination = row?.selected_library_id;
    if (!['movie', 'tv'].includes(type) || !Number.isInteger(id) || id <= 0 ||
        !Number.isInteger(destination) || active.get(destination) !== type ||
        typeof row.was_correction !== 'boolean') { coverage.invalidRows++; continue; }
    const key = `${type}:${id}`, doc = known.get(key);
    if (!doc) { coverage.withoutInventoryDescription++; continue; }
    // A correction can precede a move/sync. Membership is coverage, not label authority.
    if (!doc.libraryIds.includes(destination)) coverage.absentFromCurrentInventory++;
    if (!groups.has(key)) groups.set(key, { doc, destinations: new Set(), correction: false });
    const group = groups.get(key);
    group.destinations.add(destination);
    group.correction ||= row.was_correction;
  }
  const labels = new Map();
  for (const [key, group] of groups) {
    if (group.destinations.size !== 1) { coverage.conflictingIdentities++; continue; }
    const libraryId = [...group.destinations][0];
    labels.set(key, { libraryId, kind: group.correction ? 'correction' : 'confirmation' });
    coverage[group.correction ? 'corrections' : 'confirmations']++;
  }
  coverage.labeledIdentities = labels.size;
  return { labels, coverage };
}
