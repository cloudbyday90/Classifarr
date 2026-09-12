/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Outcome-based case/control selection is diagnostic, not a deployable routing policy. */
export function planContrastiveInvestigationCases(prepared, baseline, maximumDisagreements = 100) {
  if (!Number.isInteger(maximumDisagreements) || maximumDisagreements < 0 || maximumDisagreements > 100 ||
      prepared.cases.length > 300 || baseline.length > prepared.cases.length) throw new Error('contrastive_investigation_budget_invalid');
  const eligible = baseline.map((result, index) => ({ result, index }))
    .filter(({ result }) => ['proposed', 'abstained'].includes(result.status));
  const flagged = eligible.filter(({ result }) => !result.agreement).map(({ index }) => index);
  const disagreements = flagged.slice(0, maximumDisagreements);
  const available = eligible.filter(({ result }) => result.agreement).map(({ index }) => index);
  const controls = [], matches = { library: 0, media: 0, other: 0 };
  for (const index of disagreements) {
    const entry = prepared.cases[index];
    const sameMedia = candidate => prepared.cases[candidate].mediaType === entry.mediaType;
    let position = available.findIndex(candidate => sameMedia(candidate) &&
      prepared.cases[candidate].observedLibraryIds.some(id => entry.observedLibraryIds.includes(id)));
    let match = 'library';
    if (position < 0) { position = available.findIndex(sameMedia); match = 'media'; }
    if (position < 0 && available.length) { position = 0; match = 'other'; }
    if (position < 0) break;
    controls.push(available.splice(position, 1)[0]); matches[match]++;
  }
  return { disagreements, controls, summary: { flagged: flagged.length, selectedDisagreements: disagreements.length,
    deferredDisagreements: flagged.length - disagreements.length, selectedControls: controls.length,
    controlShortfall: disagreements.length - controls.length, controlMatches: matches } };
}
