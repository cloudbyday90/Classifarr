/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isValidDescriptionComparison } from './inventoryDescriptionBenchmarkComparison.mjs';

/** Use only pairs with two valid semantic outcomes; technical failures never become losses. */
export function summarizeContentFirstPairs(pairs, requested) {
  const complete = pairs.filter(pair => pair.named && pair.anonymous);
  const valid = complete.filter(pair => isValidDescriptionComparison(pair.named) && isValidDescriptionComparison(pair.anonymous));
  const gained = valid.filter(pair => !pair.named.agreement && pair.anonymous.agreement).length;
  const lost = valid.filter(pair => pair.named.agreement && !pair.anonymous.agreement).length;
  return { requested, completedPairs: complete.length, validPairs: valid.length,
    missingPairs: requested - complete.length, invalidPairs: complete.length - valid.length,
    namedAgreed: valid.filter(pair => pair.named.agreement).length,
    anonymousAgreed: valid.filter(pair => pair.anonymous.agreement).length,
    gained, lost, netAgreementChange: gained - lost,
    bothAgreed: valid.filter(pair => pair.named.agreement && pair.anonymous.agreement).length,
    bothDisagreed: valid.filter(pair => !pair.named.agreement && !pair.anonymous.agreement).length,
    changedProposalOrAbstention: valid.filter(pair => pair.named.destinationId !== pair.anonymous.destinationId).length };
}

export function summarizeContentFirstStrata(prepared, pairs, requested) {
  const summarizeGroup = accepts => {
    const indices = prepared.cases.slice(0, requested).flatMap((entry, index) => accepts(entry) ? [index] : []);
    return summarizeContentFirstPairs(indices.flatMap(index => pairs[index] ? [pairs[index]] : []), indices.length);
  };
  return { media: ['movie', 'tv'].map(mediaType => ({ mediaType, ...summarizeGroup(entry => entry.mediaType === mediaType) })),
    libraries: prepared.libraryStrata.map(({ id, stratum }) => ({ stratum,
      ...summarizeGroup(entry => entry.observedLibraryIds.includes(id)) })) };
}
