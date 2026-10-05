/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { libraryIngestionState } from './libraryIngestionStatus'
import { libraryRecoveryDeployment } from './libraryRecoveryDeployment'

const guidance = Object.freeze({
  automatic: ['progress', 'Automatic recovery queued', 'Existing inventory is kept while Classifarr restarts the import. No action needed.'],
  active: ['progress', 'Import in progress', 'This library is importing. No action needed.'],
  awaiting_import: ['progress', 'Import queued', 'The import starts when capacity is available. No action needed.'],
  requested: ['progress', 'Import requested', 'Classifarr is checking whether the import can start.'],
  interrupted: ['progress', 'Automatic restart pending', 'Existing inventory is kept. Classifarr will restart the scan automatically.'],
  retry_wait: ['progress', 'Automatic retry scheduled', 'Existing inventory is kept. Wait for the scheduled retry.'],
  source_wait: ['progress', 'Waiting for media server', 'Classifarr will check the connection again. No action needed unless the server stays offline.'],
  unconfigured: ['attention', 'Connection setup needed', 'Open the library and configure its media server connection.'],
  source_review: ['attention', 'Media server needs review', 'Check the media server and proxy settings, then correct and save its connection settings.'],
  review: ['attention', 'Import needs attention', 'An earlier import did not finish. Open the library to review it and safely resume.'],
  deployment_required: ['attention', 'Setup needs attention', 'Classifarr cannot safely restart this import yet. Follow the steps below.'],
  unknown: ['attention', 'Import status needs review', 'Open the library for its current status. Do not assume the import is complete.'],
})

export function libraryRecoveryReport(libraries, { unavailable = false } = {}) {
  if (unavailable) return { state: 'unavailable', items: [], attention: 0, progress: 0 }
  if (!Array.isArray(libraries)) return { state: 'loading', items: [], attention: 0, progress: 0 }
  const items = []
  const seen = new Set()
  for (const library of libraries) {
    if (!library || library.is_active === false || library.archived_at || !['movie', 'tv'].includes(library.media_type)) continue
    const id = Number(library.id)
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue
    seen.add(id)
    const state = libraryIngestionState(library)
    const mode = library.ingestion_status?.recoveryMode
    if (state === 'disabled' || mode === 'disabled') continue
    let key = state
    if (state === 'legacy_owner_unknown') key = mode || 'review'
    if (state === 'complete' && library.ingestion_status?.state === 'complete') continue
    if (state === 'complete') key = 'unknown'
    const [severity, title, message] = Object.hasOwn(guidance, key) ? guidance[key] : guidance.unknown
    const deployment = key === 'deployment_required' ? libraryRecoveryDeployment(library.ingestion_status?.recoveryDiagnostic) : null
    items.push({ id, name: String(library.name || `Library ${id}`), severity, title: deployment?.title || title, message,
      deployment, path: `/libraries/${id}`, action: key === 'review' ? 'Review and resume' : severity === 'attention' ? 'Open library' : 'View import' })
  }
  // Keep actionable issues above ordinary background progress; preserve library order within each group.
  items.sort((a, b) => Number(a.severity !== 'attention') - Number(b.severity !== 'attention'))
  const attention = items.filter(item => item.severity === 'attention').length
  return { state: 'ready', items, attention, progress: items.length - attention }
}
