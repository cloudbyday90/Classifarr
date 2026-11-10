/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** No suggestion means no destination. Choice construction stays with its existing owner. */
export function buildUnresolvedRecoveryAdvice(libraries) {
  return {
    library: null,
    confidence: 50,
    method: 'fallback',
    reason: 'AI unavailable - choose a destination for this item',
    libraries,
  };
}
