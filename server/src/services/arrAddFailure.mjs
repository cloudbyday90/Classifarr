/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Preserve only the decision needed by reconciliation, never raw provider data. */
export function arrAddFailure(provider, error) {
  const failure = new Error(provider === 'radarr' ? 'Failed to add movie to Radarr' : 'Failed to add series to Sonarr');
  const status = error?.response?.status;
  failure.code = Number.isInteger(status) && status >= 400 && status < 500 && ![408, 409].includes(status)
    ? 'ARR_ADD_REJECTED' : 'ARR_ADD_UNCERTAIN';
  return failure;
}
