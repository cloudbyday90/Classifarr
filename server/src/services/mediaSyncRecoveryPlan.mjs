/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const SOURCE_RECOVERY_ATTEMPT_LIMIT = 8;

function compare(left, right) {
  if (left.attemptedAt !== right.attemptedAt) {
    if (left.attemptedAt === null) return -1;
    if (right.attemptedAt === null) return 1;
    return left.attemptedAt - right.attemptedAt;
  }
  return left.item.external_id < right.item.external_id ? -1
    : left.item.external_id > right.item.external_id ? 1 : 0;
}

/** Bounded top-k selection across pages, not just within the first source page. */
export function createMediaSyncRecoveryPlan({ limit = SOURCE_RECOVERY_ATTEMPT_LIMIT } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 32) throw new TypeError('Invalid recovery plan bound');
  let candidates = [];
  return Object.freeze({
    get size() { return candidates.length; },
    withdraw(externalId) {
      const index = candidates.findIndex(candidate => candidate.item.external_id === externalId);
      return index < 0 ? null : candidates.splice(index, 1)[0].item;
    },
    offer(item, attemptedAt) {
      if (typeof item?.external_id !== 'string' || !item.external_id.trim() ||
          (attemptedAt !== null && (!Number.isFinite(attemptedAt) || attemptedAt < 0))) {
        throw new TypeError('Invalid recovery priority');
      }
      if (candidates.some(candidate => candidate.item.external_id === item.external_id)) {
        throw new Error('Withdraw a previous source snapshot before replacing it');
      }
      const candidate = { item: structuredClone(item), attemptedAt };
      candidates.push(candidate);
      candidates.sort(compare);
      const removed = candidates.length > limit ? candidates.pop() : null;
      return { admitted: removed !== candidate, evicted: removed && removed !== candidate ? removed.item : null };
    },
    drain() {
      const items = candidates.map(candidate => candidate.item);
      candidates = [];
      return items;
    },
  });
}
