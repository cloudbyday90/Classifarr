/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CATALOG_CONTRACTS } from './libraryDiscoveryFailure.mjs';

const MESSAGES = Object.freeze({
  not_configured: ['Connect a media server', 'Connect and save Plex, Emby or Jellyfin to discover libraries.'],
  not_recorded: ['No discovery result recorded', 'Use Sync Libraries to check the saved connection.'],
  configuration_changed: ['Connection changed', 'Run Sync Libraries to check the new connection.'],
  checking: ['Discovering libraries', 'Wait for the scan, then refresh this status.'],
  interrupted: ['Scan outcome not recorded', 'Check ongoing work before starting another scan; this does not prove the worker stopped.'],
  complete: ['Library discovery complete', 'Review your libraries; content ingestion and backfill have separate progress.'],
  authentication: ['Credentials were rejected', 'Update the saved media-server token, save, then sync libraries.'],
  forbidden: ['Library access was denied', 'Check the saved account or API key has library access, then sync again.'],
  rate_limited: ['Media server requested a pause', 'Wait before using Sync Libraries again; avoid repeated requests.'],
  unreachable: ['Media server could not be reached', 'Check the server is running and its saved address is reachable from Classifarr, then sync again.'],
  timeout: ['Media server took too long', 'Let the server finish busy work, check its connection, then sync again.'],
  invalid_catalog: ['Library list was incomplete or invalid', 'Check the media server and reverse proxy are returning the full library list, then sync again. Existing libraries are preserved.'],
  endpoint_unavailable: ['Library API was not available', 'Check the saved server type, address and reverse-proxy base path, then sync again.'],
  cancelled: ['Library discovery was cancelled', 'Check whether the application restarted or the request was cancelled before retrying.'],
  response_too_large: ['Library response exceeded the safety limit', 'Check the server or proxy response; do not disable the safety limit to accept a partial list.'],
  provider_unavailable: ['Media server returned an error', 'Check its health and logs, then sync again after it recovers.'],
  local_update_failed: ['Library list could not be saved', 'Check Classifarr database health before retrying Sync Libraries.'],
  unknown: ['Library discovery could not finish', 'Check the saved connection and Classifarr logs before retrying.'],
});
const timestamp = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;

/** Fixed public vocabulary only; never spread a database or provider object. */
export function presentLibraryDiscovery(row) {
  const current = row && row.source_revision != null && String(row.current_revision) === String(row.source_revision);
  let reason = !row ? 'not_configured' : row.source_revision == null ? 'not_recorded'
    : !current ? 'configuration_changed' : row.outcome_unrecorded ? 'interrupted' : row.reason;
  if (!Object.hasOwn(MESSAGES, reason)) reason = 'unknown';
  const [title, nextStep] = MESSAGES[reason];
  return {
    provider: ['plex', 'emby', 'jellyfin'].includes(row?.provider) ? row.provider : null,
    reason, title, nextStep,
    attemptedAt: current ? timestamp(row.started_at) : null,
    finishedAt: current ? timestamp(row.finished_at) : null,
    lastSuccessAt: current ? timestamp(row.last_success_at) : null,
    lastSuccessCount: current && Number.isInteger(row.last_success_count) && row.last_success_count >= 0 && row.last_success_count <= 1000 ? row.last_success_count : null,
    contract: current && row.finished_at && CATALOG_CONTRACTS.includes(row.contract) ? row.contract : 'unknown',
    httpStatus: current && Number.isInteger(row.http_status) && row.http_status >= 100 && row.http_status <= 599 ? row.http_status : null,
  };
}
