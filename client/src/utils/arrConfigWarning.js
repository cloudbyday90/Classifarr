/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/**
 * @typedef {object} ArrConfigWarning
 * @property {number} id
 * @property {'Radarr' | 'Sonarr'} type
 * @property {string} name
 * @property {'/settings/radarr' | '/settings/sonarr'} route
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Turn untrusted status data into supported display-only warnings.
 * An empty result is not an assertion that the remote configuration is healthy.
 * @param {unknown} status
 * @returns {ArrConfigWarning[]}
 */
export function parseArrConfigWarnings(status) {
  if (!isRecord(status) || !Array.isArray(status.incompleteConfigs)) return []

  /** @type {ArrConfigWarning[]} */
  const warnings = []
  const seen = new Set()
  for (const row of status.incompleteConfigs) {
    if (!isRecord(row)
      || (row.type !== 'Radarr' && row.type !== 'Sonarr')
      || row.missingField !== 'quality_profile_id'
      || typeof row.id !== 'number' || !Number.isSafeInteger(row.id) || row.id <= 0
      || (row.name != null && typeof row.name !== 'string')) continue

    const key = `${row.type}-${row.id}`
    if (seen.has(key)) continue
    seen.add(key)
    warnings.push({
      id: row.id,
      type: row.type,
      name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : `${row.type} ${row.id}`,
      route: row.type === 'Radarr' ? '/settings/radarr' : '/settings/sonarr',
    })
  }
  return warnings
}
