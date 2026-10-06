/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fitInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfileFit.mjs';
import { discoverCommunityParticipation } from '../../services/inventoryCommunityParticipation.mjs';

/** Observe existing seams; do not patch workers or retain their vector payloads. */
export function createComparisonStudyPhases(metrics, prefix, {
  fit = fitInventoryRepresentativeProfile, discover = discoverCommunityParticipation,
} = {}) {
  return {
    async fit(...args) {
      await metrics.mark(`${prefix}_worker_fit`);
      const model = await fit(...args);
      await metrics.mark(`${prefix}_control`);
      return model;
    },
    async discover(...args) {
      await metrics.mark(`${prefix}_community`);
      const result = await discover(...args);
      for (const media of result.media.values()) {
        metrics.track('communityRows', media.rows);
        if (media.rows.length) metrics.track('communityVector', media.rows[0].vector);
      }
      await metrics.mark(`${prefix}_quality`);
      return result;
    },
  };
}
