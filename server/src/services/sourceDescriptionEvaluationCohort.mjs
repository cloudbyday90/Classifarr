/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { inventorySourceDescriptionKey, inventoryDescriptionQueryAliases } from './inventorySourceDescriptionIdentity.mjs';
import { projectInventoryDescription } from './inventoryDescriptionProjection.mjs';
import { prepareInventoryOutcomeLabels, inventoryOutcomeIdentity } from './inventoryOutcomeLabels.mjs';
import { validateDescriptionBenchmarkOptions } from './inventoryDescriptionBenchmarkSelection.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/** Conservative transitive exclusion, never identity repair or membership merging. */
export function groupSourceDescriptionEvidence(rows) {
  if (!Array.isArray(rows) || rows.length > 50000) throw new Error('source_pair_row_budget');
  const parents = new Map(), anchors = new Map(), descriptions = new Map();
  function root(key) {
    let current = key;
    while (parents.get(current) !== current) current = parents.get(current);
    while (key !== current) { const next = parents.get(key); parents.set(key, current); key = next; }
    return current;
  }
  for (const row of rows) {
    const key = inventorySourceDescriptionKey(row);
    if (!parents.has(key)) parents.set(key, key);
    const aliases = inventoryDescriptionQueryAliases(row);
    const text = projectInventoryDescription({ metadata: { overview: row.overview } })?.text;
    const hash = text ? digest(text) : null;
    if (!descriptions.has(key)) descriptions.set(key, new Set());
    if (hash) descriptions.get(key).add(hash);
    const tokens = [hash && `description:${hash}`, aliases.imdbId && `${row.media_type}:imdb:${aliases.imdbId}`,
      aliases.tvdbId && `${row.media_type}:tvdb:${aliases.tvdbId}`, aliases.sourceKey];
    for (const token of tokens.filter(Boolean)) {
      if (!anchors.has(token)) anchors.set(token, key);
      const a = root(key), b = root(anchors.get(token));
      parents.set(compare(a, b) < 0 ? b : a, compare(a, b) < 0 ? a : b);
    }
  }
  const groupByKey = new Map(), hashesByGroup = new Map();
  for (const key of parents.keys()) {
    const group = root(key);
    groupByKey.set(key, group);
    if (!hashesByGroup.has(group)) hashesByGroup.set(group, new Set());
    for (const hash of descriptions.get(key)) hashesByGroup.get(group).add(hash);
  }
  // A formerly source-only item may now have a TMDB key. Its old outcome is not
  // transferred as a label, but the still-known source alias must prevent leakage.
  for (const [token, key] of anchors) {
    if (token.startsWith('source:')) groupByKey.set(token, root(key));
  }
  return { groupByKey, hashesByGroup };
}

/** Labels never choose candidates; all feedback-linked groups are held out of training. */
export function prepareSourceDescriptionEvaluationCohort(source, options) {
  const { seed, size } = validateDescriptionBenchmarkOptions(options);
  const { groupByKey, hashesByGroup } = groupSourceDescriptionEvidence(source.rows);
  const { labels, coverage } = prepareInventoryOutcomeLabels(source.operatorFeedbackRows, source.corpus.documents, source.libraries);
  const feedbackGroups = new Map();
  for (const row of source.operatorFeedbackRows) {
    const group = groupByKey.get(inventoryOutcomeIdentity(row));
    if (!group) continue;
    if (!feedbackGroups.has(group)) feedbackGroups.set(group, new Set());
    feedbackGroups.get(group).add(row.selected_library_id);
  }
  const corrections = new Map([...labels].filter(([key, label]) => label.kind === 'correction' &&
    feedbackGroups.get(groupByKey.get(key))?.size === 1));
  const buckets = new Map();
  for (const doc of source.corpus.documents) {
    // Balance multi-library membership by assigning a deterministic stratum, not a destination label.
    const library = [...doc.libraryIds].sort((a, b) => compare(digest(`${seed}:${a}`), digest(`${seed}:${b}`)))[0];
    const stratum = `${doc.type}:${library}:${doc.id === null ? 'source_only' : 'tmdb_linked'}`;
    if (!buckets.has(stratum)) buckets.set(stratum, []);
    buckets.get(stratum).push(doc);
  }
  const ordered = [...buckets].sort(([a], [b]) => compare(digest(`${seed}:${a}`), digest(`${seed}:${b}`)))
    .map(([, docs]) => docs.sort((a, b) => Number(corrections.has(b.key)) - Number(corrections.has(a.key)) ||
      compare(digest(`${seed}:${a.key}`), digest(`${seed}:${b.key}`))));
  const selectedGroups = new Set(), sample = [];
  while (sample.length < size && ordered.some(docs => docs.length)) {
    for (const docs of ordered) {
      let doc;
      do { doc = docs.shift(); } while (doc && selectedGroups.has(groupByKey.get(doc.key)));
      if (doc) { sample.push(doc); selectedGroups.add(groupByKey.get(doc.key)); }
      if (sample.length === size) break;
    }
  }
  const heldGroups = new Set([...selectedGroups, ...feedbackGroups.keys()]);
  const trainingExcludedHashes = new Set([...heldGroups].flatMap(group => [...hashesByGroup.get(group)]));
  const feedbackExcludedHashes = new Set([...feedbackGroups.keys()].flatMap(group => [...hashesByGroup.get(group)]));
  const holdoutGroupsByHash = new Map(sample.map(doc => [doc.hash, hashesByGroup.get(groupByKey.get(doc.key))]));
  return { sample, corrections, trainingExcludedHashes, feedbackExcludedHashes, holdoutGroupsByHash, coverage: { ...coverage,
    correctionLabels: corrections.size, groups: hashesByGroup.size, sampledGroups: sample.length,
    heldOutGroups: heldGroups.size, heldOutDescriptions: trainingExcludedHashes.size,
    conflictingFeedbackGroups: [...feedbackGroups.values()].filter(destinations => destinations.size > 1).length } };
}
