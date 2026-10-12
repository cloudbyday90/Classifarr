/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/**
 * Interpret saved startup reports, not live database health or CPU eligibility.
 * @param {unknown} status
 * @returns {string | null}
 */
export function getPgvectorVariantNotice(status) {
  if (typeof status !== 'object' || status === null || Array.isArray(status)
    || !('enabled' in status) || status.enabled !== true
    || !('pgvectorVariant' in status) || status.pgvectorVariant !== 'generic') return null

  if ('pgvectorBuild' in status && status.pgvectorBuild === 'generic') {
    return 'The image reports a generic-only pgvector build. Restarting the same image will not add an optimized binary.'
  }
  if ('cpuAvx' in status && status.cpuAvx === 'false'
    && 'cpuAvx2' in status && status.cpuAvx2 === 'false') {
    return 'The host reports no AVX or AVX2 support. Generic mode is expected; no restart is needed for this notice.'
  }
  return 'Generic mode may reflect the available binaries or runtime staging restrictions. Review the pgvector selection messages in container startup logs before changing deployment settings; restarting alone does not guarantee an optimized binary.'
}
