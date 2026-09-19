/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const REASONS = ['available', 'insufficient_distinct_examples', 'no_other_library_groups',
  'no_recurring_terms', 'only_common_terms', 'no_distinctive_terms'];

/** Fold-fit counts, not unique groups, semantic certainty or accuracy. Never exports terms. */
export function createGroupTermReadinessCounter() {
  const counts = Object.fromEntries(REASONS.map(reason => [reason, 0]));
  let folds = 0;
  return {
    record(groups) {
      for (const group of groups) {
        if (!REASONS.includes(group.readiness)) throw new Error('group_readiness_unknown_reason');
        counts[group.readiness]++;
      }
      folds++;
    },
    read() { return { folds, groupFits: Object.values(counts).reduce((sum, count) => sum + count, 0), reasons: { ...counts } }; },
  };
}
