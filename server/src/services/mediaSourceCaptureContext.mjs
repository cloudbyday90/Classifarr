/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Copy capture coordinates before awaiting work; provenance is not ownership authority. */
export function snapshotSourceCapture(context) {
  return Object.freeze({ libraryId: context?.libraryId, mediaServerId: context?.mediaServerId,
    generation: context?.generation });
}
