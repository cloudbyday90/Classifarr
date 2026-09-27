/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const paginationStep = 'Check the media server version and any reverse proxy for missing or altered pagination data. Do not clear inventory; the next scheduled retry checks again.';
const issues = Object.freeze({
  unknown_source_total: ['The source did not report a total item count.', paginationStep],
  unexpected_page_offset: ['The source returned the wrong page position.', paginationStep],
  repeated_source_key: ['The source repeated items across or within pages.', paginationStep],
  changed_page_total: ['The source item count changed during the check.', 'Let the media server finish its scan. Classifarr will retry automatically.'],
  invalid_response: ['The source response could not be validated.', paginationStep],
  access_denied: ['The source denied access.', 'Check the saved media server token and its library permissions. Classifarr will retry automatically.'],
  endpoint_not_found: ['The source library endpoint was not found.', 'Check that the library still exists and the saved server address is correct. Sync the library list if it changed.'],
  rate_limited: ['The source is limiting requests.', 'Allow the server to recover. Classifarr will retry after its existing cooldown.'],
  timed_out: ['The source did not respond within the check deadline.', 'Check media server availability and load. Classifarr will retry automatically.'],
  response_too_large: ['The source exceeded the bounded response size.', 'Check whether the server or reverse proxy honors pagination. Do not clear inventory; Classifarr will retry automatically.'],
  unavailable: ['The source check is temporarily unavailable.', 'Check the media server connection. Classifarr will retry automatically; existing inventory is retained.'],
});

function diagnostic(phase, reason) {
  if (!['media', 'collections'].includes(phase) || !Object.hasOwn(issues, reason)) return null;
  const [message, nextStep] = issues[reason];
  return { phase, reason, message, nextStep };
}

/** Only fixed, application-owned codes/text cross the log and API boundary. */
export class SourcePreflightError extends Error {
  constructor(phase, reason) {
    const detail = diagnostic(phase, reason) ?? diagnostic('media', 'unavailable');
    super(`Source preflight unavailable (${detail.phase}:${detail.reason}). ${detail.message} ${detail.nextStep}`);
    this.name = 'SourcePreflightError';
    this.detail = detail;
  }
}

/** Decode only our version-one prefix; never expose arbitrary historical transport errors. */
export function readSourcePreflightDiagnostic(message) {
  if (typeof message !== 'string') return null;
  const match = /^Source preflight unavailable \((media|collections):([a-z_]+)\)\. /u.exec(message);
  return match ? diagnostic(match[1], match[2]) : null;
}

export function sourcePreflightFailureReason(error) {
  const status = error?.response?.status;
  if (status === 401 || status === 403) return 'access_denied';
  if (status === 404) return 'endpoint_not_found';
  if (status === 429) return 'rate_limited';
  if (error?.code === 'HTTP_RESPONSE_TOO_LARGE') return 'response_too_large';
  if (error?.code === 'ETIMEDOUT' || error?.name === 'TimeoutError') return 'timed_out';
  if (error?.name === 'SourceEnumerationError') {
    return Object.hasOwn(issues, error.reason) ? error.reason : 'invalid_response';
  }
  if (error instanceof TypeError || error instanceof SyntaxError) return 'invalid_response';
  return 'unavailable';
}
