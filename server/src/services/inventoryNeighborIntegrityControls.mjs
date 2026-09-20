/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assessLeaderChallengeAcceptance, leaderChallengeNomination } from './inventoryLeaderChallengeAcceptance.mjs';

/** Negative controls exercise the real cached query and acceptance boundaries; no exception payload is retained. */
export async function evaluateNeighborIntegrityControls(entry, assessment, calibration, calibrate, {
  signal, assess = assessLeaderChallengeAcceptance,
} = {}) {
  const options = { crossFit: true, exact: true, expectedContextId: calibration.contextId };
  const pair = { match: calibration.crossFitMatch, neighbor: calibration.exactNeighbor };
  const baselineAccepted = assess(assessment, pair, options).accepted;
  const rows = [];
  const queries = [
    ['missing_identity', { ...entry, itemIdentity: null }, 'inventory_calibration_query_invalid'],
    ['conflicting_media', { ...entry, itemIdentity: { ...entry.itemIdentity, mediaType: entry.mediaType === 'movie' ? 'tv' : 'movie' } }, 'inventory_calibration_query_invalid'],
    ['missing_held_query', { ...entry, heldDescriptionHashes: new Set() }, 'leader_calibration_fold_invalid'],
    ['unknown_fold', { ...entry, foldIndex: -1 }, 'leader_calibration_fold_invalid'],
  ];
  for (const [id, query, expected] of queries) {
    signal?.throwIfAborted();
    let outcome = 'unexpected_acceptance';
    try { await calibrate(query, { signal }); }
    catch (error) { signal?.throwIfAborted(); outcome = error?.message === expected ? 'rejected' : 'unexpected_error'; }
    rows.push({ id, outcome, baselineAccepted });
  }
  const otherContext = `${calibration.contextId[0] === '0' ? '1' : '0'}${calibration.contextId.slice(1)}`;
  const challengerId = leaderChallengeNomination(assessment).challengerId;
  const mutations = [
    ['missing_context', value => { delete value.match.contextId; delete value.neighbor.contextId; }],
    ['mixed_match_context', value => { value.match.contextId = otherContext; }],
    ['mixed_neighbor_context', value => { value.neighbor.contextId = otherContext; }],
    ['stale_pair_context', value => { value.match.contextId = otherContext; value.neighbor.contextId = otherContext; }],
    ['malformed_snapshot', value => { value.neighbor.snapshotId = 'invalid'; }],
    ['nonfinite_rank', value => { value.match.candidates.find(candidate => candidate.libraryId === challengerId).empiricalRank = NaN; }],
    ['incomplete_neighbors', value => { value.neighbor.candidates[0].referenceComplete = false; }],
    ['sparse_rival', value => { value.neighbor.candidates[0].status = 'sparse'; }],
    ['foreign_candidate', value => { value.neighbor.candidates[0].libraryId = 0; }],
  ];
  for (const [id, mutate] of mutations) {
    signal?.throwIfAborted();
    const changed = structuredClone(pair);
    let outcome;
    try { mutate(changed); outcome = assess(assessment, changed, options).accepted ? 'unexpected_acceptance' : 'rejected'; }
    catch { outcome = 'unexpected_error'; }
    rows.push({ id, outcome, baselineAccepted });
  }
  signal?.throwIfAborted();
  return rows;
}

export function summarizeNeighborIntegrityControls(rows) {
  const summarize = values => ({ attempted: values.length, rejected: values.filter(row => row.outcome === 'rejected').length,
    unexpectedAcceptance: values.filter(row => row.outcome === 'unexpected_acceptance').length,
    unexpectedErrors: values.filter(row => row.outcome === 'unexpected_error').length,
    positiveBaselineControls: values.filter(row => row.baselineAccepted).length });
  return { status: rows.length === 0 ? 'not_exercised' : rows.every(row => row.outcome === 'rejected') ? 'passed' : 'failed',
    ...summarize(rows), byControl: [...new Set(rows.map(row => row.id))].sort().map(id => ({ id, ...summarize(rows.filter(row => row.id === id)) })) };
}
