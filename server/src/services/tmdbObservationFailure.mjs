/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const TRANSPORT_CODES = new Set(['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN',
  'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'CERT_NOT_YET_VALID',
  'ABORT_ERR', 'ERR_CANCELED', 'HTTP_RESPONSE_TOO_LARGE']);

/** Only bounded HTTP status and allowlisted transport codes cross the boundary. */
export function tmdbObservationFailure(error) {
  const status = error?.response?.status;
  const httpStatus = Number.isInteger(status) && status >= 400 && status <= 599 ? status : null;
  const code = TRANSPORT_CODES.has(error?.code) ? error.code : null;
  const category = httpStatus === 404 ? 'not_found' : httpStatus === 401 || httpStatus === 403 ? 'authentication' :
    httpStatus === 429 ? 'rate_limited' : httpStatus >= 500 ? 'upstream_error' : httpStatus ? 'request_rejected' :
      code === 'ETIMEDOUT' ? 'timeout' : ['ABORT_ERR', 'ERR_CANCELED'].includes(code) ? 'cancelled' :
        code === 'HTTP_RESPONSE_TOO_LARGE' ? 'response_too_large' : code?.includes('CERT') || code?.includes('SIGNATURE') ? 'tls' :
          code ? 'network' : 'unknown';
  return { category, httpStatus, transportCode: code };
}

export function wrapTmdbDetailsFailure(error) {
  const details = tmdbObservationFailure(error);
  return Object.assign(new Error('TMDb details are unavailable'), {
    code: details.transportCode || 'TMDB_DETAILS_UNAVAILABLE',
    ...(details.httpStatus ? { response: { status: details.httpStatus } } : {}),
  });
}
