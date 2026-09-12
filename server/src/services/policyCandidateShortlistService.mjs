/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import * as db from '../config/database.mjs';
import { buildPolicyCandidateAdjudicationContract, buildPolicyCandidateAdjudicationPool } from './policyCandidateAdjudicationContract.mjs';
import { createLiveInventoryDescriptionRepository } from './liveInventoryDescriptionRepository.mjs';
import { inventoryDescriptionIdentity } from './inventoryDescriptionCorpus.mjs';
import { projectInventoryDescription } from './inventoryDescriptionProjection.mjs';
import { projectLiveInventoryQueryMetadata } from './liveInventoryLearnedProfile.mjs';
import { rankLearnedCandidateShortlist } from './learnedCandidateShortlistRanking.mjs';
import { resolveDeterministicOutcomeAiMode } from './classificationDeterministicAiMode.mjs';

/** Automatic local metadata learning before the three-candidate provider boundary. */
export function createPolicyCandidateShortlistService({
  repository = createLiveInventoryDescriptionRepository({ withTransaction: callback => db.withTransaction(callback) }),
  buildContract = buildPolicyCandidateAdjudicationContract,
  timeoutMs = 15000,
} = {}) {
  return {
    async build({ policyResult, libraries, metadata, signal: parentSignal } = {}) {
      const options = { policyResult, libraries, mediaType: metadata?.media_type };
      const baseline = buildContract(options);
      if (!baseline?.valid || !resolveDeterministicOutcomeAiMode({
        policyResult, libraries, candidateAdjudication: baseline,
      }).shouldInvoke) return baseline;
      const pool = buildPolicyCandidateAdjudicationPool(options);
      if (pool.length <= 3 || pool.length > 64) return baseline;
      const signal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(parentSignal ? [parentSignal] : [])]);
      try {
        signal.throwIfAborted();
        const key = inventoryDescriptionIdentity(metadata), projection = projectInventoryDescription({ metadata });
        const queryMetadata = projectLiveInventoryQueryMetadata(metadata);
        if (!projection || (!queryMetadata.genres.length && !queryMetadata.studio && !queryMetadata.rating) ||
            pool.some(candidate => candidate.mediaType !== metadata.media_type || candidate.libraryId > 2147483647)) return baseline;
        const config = await repository.readConfig();
        signal.throwIfAborted();
        if (config?.rag_enabled !== true) return baseline;
        const request = { key, mediaType: metadata.media_type, libraryIds: pool.map(candidate => candidate.libraryId),
          hash: createHash('sha256').update(projection.text).digest('hex'), queryMetadata };
        const profiles = await repository.readLearnedProfiles({ request, signal });
        signal.throwIfAborted();
        if ((await repository.readConfig())?.rag_enabled !== true) return baseline;
        signal.throwIfAborted();
        const candidateOrder = rankLearnedCandidateShortlist(pool, profiles);
        return buildContract({ ...options, candidateOrder });
      } catch {
        // Keep the policy baseline on failure; provider/DB details can contain private data.
        return baseline;
      }
    },
  };
}
