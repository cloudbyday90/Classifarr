/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { rememberInventoryRankingShadow, getInventoryRankingShadow } from '../../services/inventoryRankingShadow.mjs';

export function inventoryRankingShadowFixture(type = 'movie') {
  const item = { tmdb_id: 123, media_type: type, overview: 'A long journey across the ocean to find a lost ship.' };
  const evaluations = [1, 2].map(library_id => ({ library_id }));
  const evidence = { statusId: 'available', candidates: [1, 2].map(libraryId => ({
    libraryId, eligible: 30, indexed: 30,
    learnedProfile: { version: 'contrastive_profile_v1', statusId: 'neutral', relativeFit: 0,
      trainingDescriptions: 60, snapshotId: 'a'.repeat(64),
      companyProfile: { version: 'production_company_set_v1', relativeFit: libraryId === 1 ? -2 : 2, trainingDescriptions: 30 } },
    items: [0, 1, 2].map(n => ({ description: `Private description ${libraryId}-${n}`,
      similarity: libraryId === 1 ? .85 : .8, sharedAcrossCandidates: false })),
  })) };
  rememberInventoryRankingShadow(evaluations, item, evidence);
  const capture = getInventoryRankingShadow(evaluations);
  return { item, evaluations, evidence, capture, result: { policyResult: { inventoryRankingShadow: capture } } };
}
