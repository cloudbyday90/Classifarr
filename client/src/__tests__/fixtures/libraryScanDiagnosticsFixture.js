/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { incrementalLibraryCoverageFixture } from './incrementalLibraryCoverageFixture'

export function libraryScanDiagnosticsFixture() {
  const report = incrementalLibraryCoverageFixture()
  report.observedAt = '2026-09-05T12:00:00Z'
  const libraries = Array.from({ length: 13 }, (_, index) => ({ libraryId: index + 1, isActive: true,
    legacyVisitCount: 0, visitCount: 1, completedScans: 1, partialVisits: 0, discardedVisits: 0,
    restartReasons: {}, firstVisitAt: '2026-09-05T10:00:00Z', lastVisitAt: '2026-09-05T10:15:00Z',
    lastCompletedAt: '2026-09-05T10:15:00Z', lastMeasurementAt: '2026-09-05T10:00:00Z', lastCompletedDurationMinutes: 15,
    unresolvedSince: null, restartsSinceCompletion: 0, discardedSinceCompletion: 0, expirationsSinceCompletion: 0,
    observedSpanMinutes: 15, lastCompletionAgeMinutes: 5, unresolvedElapsedMinutes: null,
    completionEvidence: 'retained_completion', repeatedResets: false }))
  for (const id of [1, 3, 12, 13]) {
    Object.assign(libraries[id - 1], { completedScans: 0, lastCompletedAt: null, lastMeasurementAt: null,
      lastCompletedDurationMinutes: null, lastCompletionAgeMinutes: null, completionEvidence: 'no_retained_completion',
      unresolvedSince: '2026-09-05T10:00:00Z', unresolvedElapsedMinutes: 20, partialVisits: 1 })
  }
  Object.assign(libraries[2], { partialVisits: 0, discardedVisits: 1, discardedSinceCompletion: 1 })
  Object.assign(libraries[11], { restartReasons: { expired: 1 }, restartsSinceCompletion: 1, expirationsSinceCompletion: 1 })
  Object.assign(libraries[12], { visitCount: 3, partialVisits: 2, discardedVisits: 1, discardedSinceCompletion: 1,
    restartReasons: { inventory_changed: 1, expired: 1 }, restartsSinceCompletion: 2,
    expirationsSinceCompletion: 1, repeatedResets: true })
  for (const id of [12, 13]) {
    Object.assign(report.librarySamples.find(point => point.libraryId === id), { status: 'in_progress',
      comparison: 'in_progress', scannedRows: 20000, restartReason: 'expired', inventoryRows: null,
      supportedRows: null, identifiedRows: null, capturedRows: null, freshRows: null, keywordRows: null, languageRows: null, delta: null })
  }
  const resetting = report.librarySamples.find(point => point.libraryId === 13)
  report.librarySamples.push({ ...resetting, observedAt: '2026-09-05T10:55:00Z', scanStartedAt: '2026-09-05T10:55:00Z', restartReason: 'inventory_changed' },
    { ...resetting, observedAt: '2026-09-05T09:50:00Z', scanStartedAt: '2026-09-05T09:50:00Z',
      status: 'invalidated', comparison: 'invalidated', scannedRows: 0, restartReason: 'changed_before_write' })
  report.librarySamples.sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))
  // Keep visible diagnostic times/counts consistent with the visit-table fixture.
  const elapsed = (end, start) => (Date.parse(end) - Date.parse(start)) / 60000
  for (const library of libraries) {
    const visits = report.librarySamples.filter(point => point.libraryId === library.libraryId)
    const completed = visits.filter(point => point.status === 'available')
    Object.assign(library, { visitCount: visits.length, completedScans: completed.length,
      firstVisitAt: visits.at(-1).observedAt, lastVisitAt: visits[0].observedAt,
      observedSpanMinutes: elapsed(visits[0].observedAt, visits.at(-1).observedAt) })
    if (completed.length) Object.assign(library, { lastCompletedAt: completed[0].observedAt,
      lastMeasurementAt: completed[0].scanStartedAt, lastCompletionAgeMinutes: elapsed(report.observedAt, completed[0].observedAt),
      lastCompletedDurationMinutes: elapsed(completed[0].observedAt, completed[0].scanStartedAt) })
    else Object.assign(library, { unresolvedSince: visits.at(-1).observedAt,
      unresolvedElapsedMinutes: elapsed(report.observedAt, visits.at(-1).observedAt) })
  }
  Object.assign(libraries[0], { restartReasons: { inventory_changed: 1 }, restartsSinceCompletion: 1 })
  report.scanDiagnostics = { version: 'library.scan_diagnostics.v1', windowStartAt: '2026-08-29T12:05:00Z',
    windowEndAt: report.observedAt, retainedPointLimit: 2016,
    catalog: { activeLibraryCount: 15, withIncrementalVisits: 13, withCompletedScans: 9, withoutCompletedScans: 6,
      withoutIncrementalVisits: 2, unvisitedLibraryIds: [14, 15], unvisitedPreviewLimit: 12, unvisitedOmittedCount: 0 }, libraries }
  return report
}
