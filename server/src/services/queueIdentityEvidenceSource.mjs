/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { buildTmdbExternalIdRequest } from './tmdbExternalIdMatch.mjs';

/** Saved declarations support a diagnostic, never permission to replace an ID. */
export function planQueueIdentityEvidence(task) {
  const stop = (reason) => ({ reason, requests: [] });
  const linked = task.webhook_log_id != null;
  if (linked && (task.source_id == null || String(task.source_id) !== String(task.webhook_log_id))) {
    return stop('source_unavailable');
  }
  if (linked && (positiveDatabaseInteger(task.source_tmdb_id) !== Number(task.tmdb_id) ||
      task.source_media_type !== task.media_type)) return stop('source_conflict');

  const declarations = [
    ['imdb_id', [task.task_imdb_id, ...(linked ? [task.source_imdb_id, task.source_imdb_legacy_id] : [])]],
    ...(task.media_type === 'tv' ? [['tvdb_id', [task.task_tvdb_id,
      ...(linked ? [task.source_tvdb_id, task.source_payload_tvdb_id, task.source_payload_tvdb_legacy_id] : [])]]] : []),
  ];
  const requests = [];
  for (const [source, values] of declarations) {
    const present = values.filter((value) => value != null);
    const parsed = present.map((value) => buildTmdbExternalIdRequest(value, source));
    if (parsed.some((request) => !request)) return stop('invalid_external_id');
    if (new Set(parsed.map((request) => request.externalId)).size > 1) return stop('conflicting_external_ids');
    if (parsed.length) requests.push(parsed[0]);
  }
  return { reason: requests.length ? null : 'external_ids_missing', requests };
}
