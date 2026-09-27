/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Test-only envelope builder. Paged fixtures must supply their full dataset total. */
export function sourcePageFixture(items, { offset = 0, total = items?.length } = {}) {
  return { items, keys: Array.isArray(items) ? items.map(item => item?.external_id) : null, offset, total };
}

/** Adapt existing synthetic item callbacks; production never infers totals from array length. */
export function withSourcePageFixtures(source, total) {
  return { ...source,
    async getLibraryPage(...args) {
      const items = await source.getLibraryItems(...args);
      return sourcePageFixture(items, { offset: args[3]?.offset ?? 0, total: total ?? items?.[0]?.total ?? items?.length });
    },
    async getCollectionPage(...args) {
      return sourcePageFixture(await source.getCollections(...args), { offset: args[3]?.offset ?? 0 });
    },
  };
}
