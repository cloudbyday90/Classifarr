/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fitInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfileFit.mjs';
import { discoverCommunityParticipation } from '../../services/inventoryCommunityParticipation.mjs';

/** Observe existing seams; do not patch workers or retain their vector payloads. */
export function createComparisonStudyPhases(metrics, prefix, {
  fit = fitInventoryRepresentativeProfile, discover = discoverCommunityParticipation, allocations = null,
} = {}) {
  let finish;
  const close = async (completed = true) => { const current = finish; finish = null; await current?.(completed); };
  return {
    close,
    async fit(...args) {
      await metrics.mark(`${prefix}_worker_fit`);
      const model = await fit(...args);
      await metrics.mark(`${prefix}_control`);
      finish = await allocations?.begin('build_control');
      return model;
    },
    async discover(...args) {
      await close();
      await metrics.mark(`${prefix}_community`);
      const result = allocations ? await allocations.run('community_build', () => discover(...args)) : await discover(...args);
      for (const media of result.media.values()) {
        metrics.track('communityRows', media.rows);
        if (media.rows.length) metrics.track('communityVector', media.rows[0].vector);
      }
      await metrics.mark(`${prefix}_quality`);
      finish = await allocations?.begin('build_quality');
      return result;
    },
  };
}
