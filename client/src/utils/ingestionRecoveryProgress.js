/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const stages = { requested: 'Recovery requested', importing: 'Importing', backfilling: 'Backfilling metadata',
  waiting: 'Waiting to retry', blocked: 'Needs attention', completed: 'Recovery completed', superseded: 'Replaced by later work' }
const actions = {
  disabled: 'Enable the library and its source when ready.', unconfigured: 'Check the media server connection settings.',
  ownership_review: 'Review the blocked import before recovery.', source_retry: 'Source recovery will retry automatically.',
  import_retry: 'The import will retry automatically when its cooldown ends.', source_ids: 'Review media IDs, then run a new full scan.',
  enqueue_pending: 'The scheduler is preparing metadata work.', metadata_failures: 'Review failed metadata tasks before retrying them.',
  metadata_pending: 'Metadata work remains; check deferred tasks if progress stops.', verification_pending: 'Waiting for the next bounded verification.',
  new_scan: 'Check the current library import for newer progress.', new_recovery: 'Use the newer recovery receipt.',
  source_changed: 'Source settings changed; check the current library import.',
}
export function recoveryProgressView(progress) {
  const label = stages[progress?.stage]
  if (!label) return { label: 'Completion not tracked', action: 'This older receipt has no verified progress link.', counts: null }
  const counts = progress.metadata
  const valid = counts && ['total', 'ready', 'pending', 'blocked'].every(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0)
    && counts.ready + counts.pending + counts.blocked === counts.total
  return { label, action: progress.stage === 'completed' ? 'Import and metadata verified. Optional AI work is separate.'
    : actions[progress.reason] ?? 'The scheduler will continue this recovery.', counts: valid ? counts : null }
}
