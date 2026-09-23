/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Numeric attribution only; null means unavailable, not evidence against a library. */
export function scoreInventoryProfileFields(model, libraryId, metadata, fields = ['genres', 'studio', 'rating']) {
  const scores = Object.fromEntries(fields.map(field => [field, null]));
  const profile = model.profiles.get(libraryId);
  if (!profile || !metadata) return scores;
  const background = model.background.get(profile.mediaType);
  for (const field of Object.keys(scores)) {
    const local = profile.fields[field], global = background[field];
    if (!local?.total || !global || global.total - local.total < 1) continue;
    const terms = [...new Set(Array.isArray(metadata[field]) ? metadata[field] : metadata[field] ? [metadata[field]] : [])];
    // Universally observed traits carry no contrast, even with unequal library sizes.
    const values = terms.filter(term => global.counts.has(term) && global.counts.get(term) < global.total - 1e-9);
    if (!values.length) continue;
    scores[field] = values.reduce((sum, term) => {
      const count = local.counts.get(term) ?? 0, all = global.counts.get(term);
      const inside = (count + 1) / (local.total + 2);
      const outside = (Math.max(0, all - count) + 1) / (Math.max(0, global.total - local.total) + 2);
      return sum + Math.log(inside / outside) * (all / (all + 3));
    }, 0) / values.length * (local.total / (local.total + 20));
  }
  return scores;
}

export function meanInventoryProfileFields(fields) {
  const scores = Object.values(fields).filter(Number.isFinite);
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
}
