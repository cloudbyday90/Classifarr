/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const LIBRARY_INGESTION_COPY = Object.freeze({
  awaiting_import: ['Library backfill scheduled', 'Existing items are kept. Classifarr will check the full library automatically when import capacity is available; learning waits.'],
  active: ['Importing library', 'Learning waits until this import finishes. No action needed.'],
  requested: ['Import requested', 'Checking whether this library can start.'],
  interrupted: ['Import interrupted', 'Imported items are safe. Classifarr will replay the scan automatically.'],
  retry_wait: ['Import retry scheduled', 'Imported items are safe. Classifarr will retry automatically; learning is waiting.'],
  legacy_owner_unknown: ['Interrupted import needs review', 'An older scan is still marked unfinished. Review the blocked import and confirm old workers have stopped before recovery.'],
  disabled: ['Import paused', 'The library or media server is disabled. Enable it when you want imports to resume.'],
  unconfigured: ['Import waiting for setup', 'Configure the media server connection before imports can resume.'],
  source_wait: ['Waiting for media server', 'Imports share a recovery check. Existing items are safe; no action is needed unless the server remains offline.'],
  source_review: ['Media server recovery needs review', 'The server requested an excessive retry delay. Check its health and proxy settings, then correct and save the connection settings.'],
})

export function libraryIngestionState(library, requesting = false) {
  if (requesting) return 'requested'
  const status = library?.ingestion_status
  if (['awaiting_import', 'interrupted', 'retry_wait'].includes(status?.state)) {
    if (status.sourceRecovery?.state === 'review') return 'source_review'
    if (['open', 'probing'].includes(status.sourceRecovery?.state)) return 'source_wait'
  }
  if (library?.ingestion_status?.state) return library.ingestion_status.state
  return ['pending', 'running'].includes(library?.sync_status?.status) ? 'legacy_owner_unknown' : 'complete'
}

export function ingestionPollInterval(library, requesting = false) {
  const state = libraryIngestionState(library, requesting)
  if (['active', 'requested'].includes(state)) return 2000
  if (['awaiting_import', 'interrupted', 'retry_wait', 'legacy_owner_unknown', 'source_wait', 'source_review'].includes(state)) return 10000
  return null
}

export function librarySyncResultMessage(result) {
  const deferred = {
    resource_busy: 'Import capacity is in use. Existing items are safe; retry later or wait for the next automatic sync.',
    resource_memory_pressure: 'Import is waiting for memory. Existing items are safe; retry later or wait for the next automatic sync.',
    resource_memory_unknown: 'Memory availability could not be checked. Import will wait; existing items are safe. Retry later.',
    ingestion_owned: 'This library is already importing.',
    ingestion_capacity: 'Two imports are active. Retry when one finishes.',
    retry_wait: 'An automatic import retry is already scheduled.',
    legacy_owner_unknown: 'Review the blocked import and confirm old workers have stopped before recovery.',
    source_disabled: 'Enable the library and media server before importing.',
    source_unconfigured: 'Configure the media server connection before importing.',
    source_preflight_unavailable: 'Import checks need attention. Open the library for the cause and next step; a retry is scheduled.',
    source_content_cooldown: 'Imports are waiting for the shared media server recovery check.',
    source_content_probe_busy: 'A shared media server recovery check is already running.',
    source_content_review: 'Review the media server recovery guidance in this library.',
    source_content_changed: 'The media server connection changed. Refresh the library status.',
  }
  if (result?.deferred) return deferred[result.reason] ?? 'Import deferred. Check the library status.'
  if (result?.skipped) return 'This content type is not imported.'
  return result?.success ? 'Library sync complete' : 'Import status is unavailable. Check the library status.'
}
