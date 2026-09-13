/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createRepresentativeFitSession, REPRESENTATIVE_MAX_PASSES, REPRESENTATIVE_STABILITY_PASSES } from './representativeFitSession.mjs';
export { representativeSimilarity, REPRESENTATIVE_MAX_GROUPS, REPRESENTATIVE_MAX_PASSES, REPRESENTATIVE_STABILITY_PASSES } from './representativeFitSession.mjs';

/** Historical fit contract; runtime recovery must explicitly use a private session. */
export async function fitRepresentativeGeometry(items, { signal, maxPasses = REPRESENTATIVE_MAX_PASSES, firstIndex = null, diagnostics = false } = {}) {
  signal?.throwIfAborted();
  if (!Number.isSafeInteger(maxPasses) || maxPasses < 1 || maxPasses > REPRESENTATIVE_STABILITY_PASSES) {
    throw new Error('inventory_representative_fit_options');
  }
  const session = createRepresentativeFitSession(items, { signal, firstIndex, diagnostics });
  try { return await session.advance(maxPasses); }
  finally { session.dispose(); }
}
