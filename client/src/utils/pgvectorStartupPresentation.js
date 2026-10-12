/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPgvectorSelectionDetails } from './pgvectorSelectionPresentation'

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value) }

/** @param {unknown} value */
function cpuFlag(value) {
  if (value === true || value === 'true') return 'Yes'
  if (value === false || value === 'false') return 'No'
  return 'Unknown'
}

/** @param {unknown} value @param {string[]} allowed */
function knownValue(value, allowed) {
  return typeof value === 'string' && allowed.includes(value) ? value : 'unknown'
}

/** Startup observations never produce an operational service-health result.
 * @param {unknown} pgvector
 */
export function getPgvectorStartupPresentation(pgvector) {
  const info = isRecord(pgvector) ? pgvector : {}
  const selection = isRecord(info.selection) ? info.selection : {}
  const report = isRecord(selection.report) ? selection.report : {}
  const facts = isRecord(selection.report) ? report : info
  const result = {
    current: false,
    cpuMismatch: false,
    label: 'Compatibility unknown',
    detail: 'Current embedded startup evidence is required to compare the selected variant with CPU support.',
    build: knownValue(facts.build, ['multi', 'generic', 'avx', 'avx2']),
    selectedVariant: knownValue(facts.selectedVariant, ['generic', 'avx', 'avx2']),
    cpuAvx: cpuFlag(facts.cpuAvx),
    cpuAvx2: cpuFlag(facts.cpuAvx2),
    selection: getPgvectorSelectionDetails(info.selection),
  }
  if (selection.status !== 'current_process' || report.schemaVersion !== 1
      || report.databaseScope !== 'embedded_entrypoint') return result
  result.current = true

  if (result.selectedVariant === 'generic') {
    result.label = 'Generic selected at startup'
    result.detail = 'Startup selected the generic variant, without AVX or AVX2 optimization.'
    return result
  }
  const support = result.selectedVariant === 'avx2' ? result.cpuAvx2
    : result.selectedVariant === 'avx' ? result.cpuAvx : 'Unknown'
  if (support === 'Yes') {
    result.label = 'CPU match reported at startup'
    result.detail = 'The reported CPU supports the selected optimization. This does not establish database readiness.'
  } else if (support === 'No') {
    result.cpuMismatch = true
    result.label = 'CPU mismatch reported at startup'
    result.detail = 'The selected optimization lacks reported CPU support. Review startup logs and image compatibility; do not force an optimized binary or relax container protections.'
  } else {
    result.detail = 'Startup did not establish CPU support for the selected variant. Do not force an optimized binary.'
  }
  return result
}
