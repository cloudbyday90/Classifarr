/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Internal arithmetic over validated, privately owned normalized vectors. */
export function scoreNeighborReferences(query, references, consumeWork) {
  consumeWork?.(query.length * references.length);
  let first = -1, second = -1, third = -1;
  for (const vector of references) {
    let dot = 0;
    for (let i = 0; i < query.length; i++) dot += query[i] * vector[i];
    const value = Math.max(-1, Math.min(1, dot));
    if (value > first) { third = second; second = first; first = value; }
    else if (value > second) { third = second; second = value; }
    else if (value > third) third = value;
  }
  return { maximum: first, minimum: third, mean: (first + second + third) / 3 };
}

export const neighborMargin = (scores, selected) => scores[selected].mean -
  Math.max(...scores.filter((_, index) => index !== selected).map(value => value.mean));

export function summarizeNeighborMarginDistributions(libraryIds, distributions, sparse, tail) {
  return libraryIds.map((libraryId, index) => {
    const positive = [...distributions[index][index]].sort((a, b) => a - b);
    const threshold = sparse ? null : Math.max(0, ...distributions[index].filter((_, source) => source !== index)
      .map(values => [...values].sort((a, b) => a - b)[Math.ceil((values.length + 1) * (1 - tail)) - 1]));
    const degenerate = !sparse && positive[Math.ceil((positive.length - 1) * .9)] - positive[Math.floor((positive.length - 1) * .1)] <= 1e-6;
    return { libraryId, positive, threshold, status: sparse ? 'sparse' : degenerate ? 'degenerate' : 'available' };
  });
}

export function assessNeighborMarginModels(models, scores, coverage, tail) {
  const referenceComplete = coverage.every(group => group.referenceDescriptions >= 3);
  return models.map((model, index) => {
    const value = referenceComplete ? neighborMargin(scores, index) : null;
    const empiricalRank = model.status === 'available' ? (1 + model.positive.filter(score => score <= value).length) / (model.positive.length + 1) : null;
    return { libraryId: model.libraryId, status: model.status, referenceComplete, ...coverage[index],
      strict: referenceComplete && scores[index].minimum > Math.max(...scores.filter((_, other) => other !== index).map(score => score.maximum)),
      mean: referenceComplete && value > 0,
      calibrated: model.status === 'available' && value > model.threshold && empiricalRank > tail };
  });
}
