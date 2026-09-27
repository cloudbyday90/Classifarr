/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function libraryIngestionState(library, requesting = false) {
  if (requesting) return 'requested'
  if (library?.ingestion_status?.state) return library.ingestion_status.state
  return ['pending', 'running'].includes(library?.sync_status?.status) ? 'legacy_owner_unknown' : 'complete'
}

export function ingestionPollInterval(library, requesting = false) {
  const state = libraryIngestionState(library, requesting)
  if (['active', 'requested'].includes(state)) return 2000
  if (['interrupted', 'retry_wait', 'legacy_owner_unknown'].includes(state)) return 10000
  return null
}

export function librarySyncResultMessage(result) {
  const deferred = {
    ingestion_owned: 'This library is already importing.',
    ingestion_capacity: 'Two imports are active. Retry when one finishes.',
    retry_wait: 'An automatic import retry is already scheduled.',
    legacy_owner_unknown: 'Verify the older or external import owner before retrying.',
    source_disabled: 'Enable the library and media server before importing.',
    source_unconfigured: 'Configure the media server connection before importing.',
    source_preflight_unavailable: 'Import checks need attention. Open the library for the cause and next step; a retry is scheduled.',
  }
  if (result?.deferred) return deferred[result.reason] ?? 'Import deferred. Check the library status.'
  if (result?.skipped) return 'This content type is not imported.'
  return result?.success ? 'Library sync complete' : 'Import status is unavailable. Check the library status.'
}
