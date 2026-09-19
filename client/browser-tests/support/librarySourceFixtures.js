/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Empty, well-shaped sibling reports prevent unrelated render failures in library tests. */
export function librarySourceFixture(path) {
  const scope = { selectedLibraryCount: 0, activeLibraryCount: 0, retentionDays: 30 }
  if (path === '/api/libraries/source-observations') return {
    observedAt: '2026-09-19T00:00:00Z', scope: { ...scope, retainedPerLibrary: 100, previewPerLibrary: 5 }, libraries: [],
  }
  if (path === '/api/libraries/source-repair-worklist') return {
    observedAt: '2026-09-19T00:00:00Z', scope: { ...scope, maximumEntries: 20, maximumEntriesPerLibrary: 5, selectedEntryCount: 0 },
    status: { id: 'no_current_conflicts' }, entries: [],
  }
  return {}
}
