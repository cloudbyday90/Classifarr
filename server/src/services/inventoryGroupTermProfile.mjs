/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';

/** Synopsis-only binary terms. No interpretation, interpolation or execution of source text. */
export function descriptionTerms(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) throw new Error('group_terms_invalid_description');
  const terms = new Set();
  for (const match of text.normalize('NFKC').toLowerCase().matchAll(/[\p{L}\p{M}]+/gu)) {
    const term = match[0];
    if (term.length >= 3 && term.length <= 64) terms.add(term);
    if (terms.size > 256) throw new Error('group_terms_description_budget');
  }
  return terms;
}

/** Private training-only model; the input is the validated, copy-excluding local index. */
export async function fitGroupTermProfile(index, texts, signal) {
  signal?.throwIfAborted();
  if (index.items.length > 20000 || texts.size > 10000) throw new Error('group_terms_input_budget');
  const media = new Map(), groups = new Map();
  let processed = 0, entries = 0;
  for (const item of index.items) {
    if (processed++ % 128 === 0) { await setImmediate(); signal?.throwIfAborted(); }
    if (index.held.has(item.hash)) throw new Error('group_terms_holdout_leak');
    if (!media.has(item.type)) media.set(item.type, { size: 0, counts: new Map() });
    const corpus = media.get(item.type), terms = descriptionTerms(texts.get(item.hash));
    corpus.size++;
    for (const term of terms) corpus.counts.set(term, (corpus.counts.get(term) ?? 0) + 1);
    if (corpus.counts.size > 100000 || (entries += terms.size) > 2_000_000) throw new Error('group_terms_vocabulary_budget');
    if (item.id === null || item.group === null) continue;
    const key = `${item.type}:${item.id}:${item.group}`;
    if (!groups.has(key)) groups.set(key, { id: item.id, type: item.type, group: item.group, size: 0, counts: new Map() });
    const group = groups.get(key); group.size++;
    for (const term of terms) group.counts.set(term, (group.counts.get(term) ?? 0) + 1);
  }
  const result = [];
  const work = [...groups.values()].reduce((sum, group) => sum + group.counts.size * groups.size, 0);
  if (work > 40_000_000) throw new Error('group_terms_work_budget');
  for (const group of groups.values()) {
    await setImmediate(); signal?.throwIfAborted();
    const corpus = media.get(group.type), weights = new Map();
    const rivals = [...groups.values()].filter(row => row.type === group.type && row.id !== group.id);
    let repeatedTerms = 0, uncommonRepeatedTerms = 0;
    for (const [term, count] of group.counts) {
      if (processed++ % 256 === 0) { await setImmediate(); signal?.throwIfAborted(); }
      if (count < 3) continue;
      repeatedTerms++;
      if (corpus.counts.get(term) * 2 > corpus.size) continue;
      uncommonRepeatedTerms++;
      if (!rivals.length) continue;
      const rival = Math.max(...rivals.map(row => ((row.counts.get(term) ?? 0) + 1) / (row.size + 2)));
      const contrast = Math.log(((count + 1) / (group.size + 2)) / rival);
      if (contrast > 0) weights.set(term, contrast * (1 + Math.log((corpus.size + 1) / (corpus.counts.get(term) + 1))));
    }
    const norm = Math.sqrt([...weights.values()].reduce((sum, weight) => sum + weight * weight, 0));
    const readiness = weights.size ? 'available' : group.size < 3 ? 'insufficient_distinct_examples' :
      !rivals.length ? 'no_other_library_groups' : !repeatedTerms ? 'no_recurring_terms' :
        !uncommonRepeatedTerms ? 'only_common_terms' : 'no_distinctive_terms';
    result.push({ id: group.id, type: group.type, group: group.group,
      readiness,
      weights: new Map([...weights].map(([term, weight]) => [term, weight / norm])) });
  }
  signal?.throwIfAborted();
  return result;
}
