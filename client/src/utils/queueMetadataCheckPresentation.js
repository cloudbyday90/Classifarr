/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const messages = Object.freeze({
  available: 'This saved TMDb record is available now. Verify it is the intended movie or series before using Retry. Nothing has been retried or changed.',
  not_found: 'TMDb still cannot find this saved ID. Retrying classification will use the same ID. A replacement needs verified identity evidence; do not substitute a similar title.',
  not_configured: 'TMDb is not configured or is disabled. Review TMDb settings before checking again.',
  authentication: 'TMDb rejected the configured credentials. Review TMDb settings before checking again.',
  rate_limited: 'TMDb is limiting requests. Wait before checking again.',
  timeout: 'TMDb did not respond in time. Check again later; this does not mean the ID is missing.',
  network: 'TMDb could not be reached. Check connectivity and try again later.',
  tls: 'The secure connection to TMDb failed. Check certificates and network settings; do not disable verification.',
  upstream_error: 'TMDb reported a server problem. Check again later.',
  request_rejected: 'TMDb rejected the lookup. Review TMDb settings; this does not prove the ID is missing.',
  invalid_response: 'TMDb returned details that could not verify this saved ID. No replacement or retry was performed.',
  response_too_large: 'TMDb returned more data than this check permits. No replacement or retry was performed.',
  cancelled: 'The check was cancelled. No replacement or retry was performed.',
})

export function queueMetadataCheckMessage(category) {
  return Object.hasOwn(messages, category) ? messages[category]
    : 'The check could not establish why TMDb is unavailable. Open a GitHub issue with the task reference and check details.'
}

export function queueMetadataCheckError(status, code) {
  if (status === 401 || status === 403) return 'Sign in with an active administrator account to check this record.'
  if (status === 409 && ['request_identity_invalid', 'request_identity_conflict'].includes(code)) {
    return 'This saved request has missing, invalid or conflicting IDs. Open a GitHub issue with the task reference so its identity can be reviewed. No lookup, replacement or retry was performed.'
  }
  if (status === 409) return 'The task or settings changed, or another check is running. Refresh and try again.'
  if (status === 404) return 'This task no longer exists. Refresh the Command Center.'
  if (status === 429) return 'Too many checks. Wait a minute before trying again.'
  return 'The metadata check is unavailable. Try again later. The task was not retried.'
}
