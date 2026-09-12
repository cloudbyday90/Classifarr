/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isProviderRecoveryRoutingBlocked } from './classificationProviderRecovery.mjs';

/** A valid local proposal is evidence only, never routing authority. */
export function isLocalCandidateProposal(aiMatch) {
  const authority = aiMatch?.ai_authority;
  return aiMatch?.format === 'confident' && !aiMatch.needs_clarification && !aiMatch.needs_retry &&
    !isProviderRecoveryRoutingBlocked(aiMatch) && authority?.version === 'ai.provider_authority.v1' &&
    authority.providerId === 'ollama' && authority.effectiveMode === 'proposal' && authority.isFallback === false &&
    authority.downgraded === false && authority.sideEffects?.canRoute === false &&
    typeof authority.model === 'string' && Boolean(authority.model.trim()) && authority.model !== 'unknown';
}
