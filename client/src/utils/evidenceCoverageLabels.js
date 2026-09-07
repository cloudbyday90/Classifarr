/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const numberFormatter = new Intl.NumberFormat()
export const evidenceNumber = value => numberFormatter.format(value)
export const evidenceLibraryLabel = row => row.library_id == null ? 'Unassigned or removed library'
  : `${row.library_name || 'Unnamed library'}${row.library_active === false ? ' (inactive)' : ''}`
const methodNames = { source_library: 'Imported membership', unknown_method: 'Unknown method',
  unlinked_feedback: 'Unlinked feedback', source_history_removed: 'Source history removed' }
export const evidenceMethodLabel = method => Object.hasOwn(methodNames, method) ? methodNames[method] : method.replaceAll('_', ' ')
