/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ServiceUnavailableError } from '../utils/appError.mjs';
import { catalogRetryAfter } from './libraryCatalogRetryAfter.mjs';

export const CATALOG_CONTRACTS = Object.freeze(['unknown', 'plex_sections', 'emby_query', 'emby_legacy', 'jellyfin_virtual_folders']);
const REASONS = ['authentication', 'forbidden', 'rate_limited', 'unreachable', 'timeout', 'invalid_catalog',
  'endpoint_unavailable', 'cancelled', 'response_too_large', 'provider_unavailable', 'configuration_changed', 'local_update_failed', 'unknown'];
const statusValue = value => Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;

/** Deliberately never inspect arbitrary messages, URLs, bodies, headers or causes. */
export function libraryDiscoveryFailure(error) {
  if (REASONS.includes(error?.catalogDiagnostic?.reason)) {
    return { reason: error.catalogDiagnostic.reason, httpStatus: statusValue(error.catalogDiagnostic.httpStatus) };
  }
  const httpStatus = statusValue(error?.response?.status);
  let reason = 'unknown';
  if (error?.code === 'library_catalog_source_changed') reason = 'configuration_changed';
  else if (error?.code === 'library_catalog_invalid') reason = 'invalid_catalog';
  else if (httpStatus === 401) reason = 'authentication';
  else if (httpStatus === 403) reason = 'forbidden';
  else if (httpStatus === 429) reason = 'rate_limited';
  else if ([404, 405].includes(httpStatus)) reason = 'endpoint_unavailable';
  else if (httpStatus >= 500) reason = 'provider_unavailable';
  else if (['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'].includes(error?.code)) reason = 'timeout';
  else if (error?.code === 'ABORT_ERR') reason = 'cancelled';
  else if (error?.code === 'HTTP_RESPONSE_TOO_LARGE') reason = 'response_too_large';
  else if (['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'ERR_NETWORK'].includes(error?.code)) reason = 'unreachable';
  return { reason, httpStatus };
}

export function unavailableLibraryCatalog(error, provider) {
  return new ServiceUnavailableError(`Failed to fetch ${provider} libraries. Check library discovery status for the next step; existing libraries were preserved.`, {
    code: 'library_catalog_unavailable', catalogDiagnostic: libraryDiscoveryFailure(error), catalogRetryAfter: catalogRetryAfter(error),
  });
}
