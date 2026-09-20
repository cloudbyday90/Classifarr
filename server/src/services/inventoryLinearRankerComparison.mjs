/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { scoreInventoryProfile } from './inventoryLearnedProfiles.mjs';
import { chooseLinearRank, scoreLinearRanker } from './inventoryLinearRankerMath.mjs';

/** Stratified synthetic label noise; never writes observations or uses held-out destinations. */
export function perturbLinearTraining(input, rows, seed) {
  const labels = new Uint16Array(input.labels);
  const groups = Array.from({ length: input.classes.length }, () => []);
  rows.forEach((doc, index) => groups[input.labels[index]].push({ index,
    rank: createHash('sha256').update(`${seed}:linear-label-noise:${doc.hash}`).digest('hex') }));
  let changed = 0;
  for (let c = 0; c < input.classes.length; c++) {
    const indices = groups[c].sort((a, b) => a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0);
    for (const row of indices.slice(0, Math.floor(indices.length / 10))) {
      labels[row.index] = (c + 1) % input.classes.length; changed++;
    }
  }
  return { labels, changed };
}

export function compareLinearRankers(input, vector, metadata, profile, clean, noisy) {
  const raw = new Array(input.classes.length).fill(-1);
  for (let row = 0; row < input.labels.length; row++) {
    let similarity = 0;
    for (let d = 0; d < input.dimensions; d++) similarity += input.matrix[row * input.dimensions + d] * vector[d];
    raw[input.labels[row]] = Math.max(raw[input.labels[row]], Math.min(1, similarity));
  }
  const scores = [raw, input.classes.map(id => scoreInventoryProfile(profile, id, metadata)),
    clean ? scoreLinearRanker(clean, vector) : [], noisy ? scoreLinearRanker(noisy, vector) : []];
  return scores.map(values => chooseLinearRank(values, values.length ? input.classes : []));
}

const emptyArm = name => ({ name, sampled: 0, selected: 0, abstained: 0, placementAgreements: 0, marginSum: 0, measuredMargins: 0 });
const names = ['nearest_description', 'organic_metadata', 'linear', 'linear_noisy_labels'];
const empty = () => ({ sampled: 0, observedOutsideTrainingClasses: 0, heldWithRetainedHistory: 0,
  noiseChangedDecisions: 0, arms: names.map(emptyArm) });

export function createLinearRankerMetrics(libraries) {
  const total = empty(), byMedia = { movie: empty(), tv: empty() };
  const byLibrary = new Map([...libraries].sort((a, b) => a.id - b.id).map((library, index) =>
    [library.id, { library: index + 1, mediaType: library.media_type, ...empty() }]));
  const record = (bucket, doc, choices, classes, history) => {
    bucket.sampled++;
    bucket.observedOutsideTrainingClasses += Number(!doc.libraryIds.some(id => classes.includes(id)));
    bucket.heldWithRetainedHistory += Number(history);
    bucket.noiseChangedDecisions += Number(choices[2].id !== choices[3].id);
    choices.forEach((choice, index) => {
      const arm = bucket.arms[index]; arm.sampled++;
      arm.selected += Number(choice.id !== null); arm.abstained += Number(choice.id === null);
      arm.placementAgreements += Number(choice.id !== null && doc.libraryIds.includes(choice.id));
      if (choice.margin !== null) { arm.marginSum += choice.margin; arm.measuredMargins++; }
    });
  };
  const output = bucket => ({ ...bucket, arms: bucket.arms.map(({ marginSum, measuredMargins, ...arm }) =>
    ({ ...arm, meanMargin: measuredMargins ? marginSum / measuredMargins : null })) });
  return {
    record(doc, choices, classes, history) {
      record(total, doc, choices, classes, history); record(byMedia[doc.type], doc, choices, classes, history);
      for (const id of doc.libraryIds) record(byLibrary.get(id), doc, choices, classes, history);
    },
    read: () => ({ ...output(total), byMedia: Object.fromEntries(Object.entries(byMedia).map(([type, value]) => [type, output(value)])),
      byLibrary: [...byLibrary.values()].map(output) }),
  };
}
