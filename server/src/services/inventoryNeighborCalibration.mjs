/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { prepareMatchCalibrationCorpus, splitMatchCalibrationGroups, validateMatchCalibrationFold, matchCalibrationDigest } from './inventoryMatchCalibrationCorpus.mjs';
import { fitLibraryNeighborMargins, NEIGHBOR_MARGIN_VERSION, NEIGHBOR_MARGIN_LIMITS } from './libraryNeighborMargin.mjs';
import { fitLibraryNeighborCrossFit, selectNeighborCrossFitGroups, NEIGHBOR_CROSS_FIT_VERSION, NEIGHBOR_CROSS_FIT_LIMITS } from './libraryNeighborCrossFit.mjs';
import { selectRepresentativeNeighborGroups, NEIGHBOR_REPRESENTATIVE_VERSION, NEIGHBOR_REPRESENTATIVE_LIMITS } from './neighborRepresentativeSelection.mjs';
import { copyNeighborReferenceTargets, measureNeighborReferenceCoverage } from './neighborReferenceCoverage.mjs';

/** One private evaluation snapshot. It cannot supply a live routing receipt. */
export function createInventoryNeighborCalibration(input, options) {
  return createCalibration(prepareMatchCalibrationCorpus(input), options);
}

/** Both experiment arms share one privately copied corpus, never caller-owned vectors. */
export function createPairedInventoryNeighborCalibration(input, { diagnostics = false } = {}) {
  const corpus = prepareMatchCalibrationCorpus(input);
  return Object.freeze({ ordered: createCalibration(corpus, { crossFit: true, diagnostics }),
    representative: createCalibration(corpus, { crossFit: true, referenceSelection: 'representative', diagnostics }) });
}

function createCalibration(corpus, { crossFit = false, referenceSelection = 'ordered', diagnostics = false } = {}) {
  if (typeof crossFit !== 'boolean' || typeof diagnostics !== 'boolean' || !['ordered', 'representative'].includes(referenceSelection) ||
      (!crossFit && (referenceSelection !== 'ordered' || diagnostics))) throw new Error('neighbor_calibration_mode_invalid');
  const representative = referenceSelection === 'representative';
  const version = representative ? NEIGHBOR_REPRESENTATIVE_VERSION : crossFit ? NEIGHBOR_CROSS_FIT_VERSION : NEIGHBOR_MARGIN_VERSION;
  const limits = representative ? NEIGHBOR_REPRESENTATIVE_LIMITS : crossFit ? NEIGHBOR_CROSS_FIT_LIMITS : NEIGHBOR_MARGIN_LIMITS;
  const fit = crossFit ? fitLibraryNeighborCrossFit : fitLibraryNeighborMargins;
  const models = new Map();
  let operations = 0, retainedComponents = 0;
  const consumeWork = count => {
    operations += count;
    if (operations > 2_000_000_000) throw new Error('neighbor_calibration_work_budget');
  };
  return Object.freeze({
    async assess(entry, { signal } = {}) {
      signal?.throwIfAborted();
      const { mediaType, descriptionHash, itemIdentity, heldDescriptionHashes: held } = entry ?? {};
      if (!(held instanceof Set) || !held.has(descriptionHash) || itemIdentity?.mediaType !== mediaType ||
          corpus.identities.get(`${mediaType}:${itemIdentity?.tmdbId}`) !== descriptionHash) throw new Error('neighbor_calibration_query_invalid');
      validateMatchCalibrationFold(corpus, mediaType, held);
      const exclusions = new Set(held);
      const targets = diagnostics ? copyNeighborReferenceTargets(entry.investigationCandidates, corpus, mediaType, exclusions) : null;
      const key = matchCalibrationDigest([version, limits, corpus.fingerprint, mediaType, [...exclusions].sort()]);
      if (!models.has(key)) {
        if (models.size >= 20) throw new Error('neighbor_calibration_fold_budget');
        const splits = splitMatchCalibrationGroups(corpus, mediaType, exclusions);
        if (splits.length < 2) return { version, candidates: [], status: 'insufficient_libraries' };
        const initialGroups = crossFit ? selectNeighborCrossFitGroups(splits, corpus.vectors) : splits.map(split => ({ libraryId: split.libraryId,
          references: split.references.slice(0, limits.references).map(hash => corpus.vectors.get(hash)),
          calibration: split.calibration.slice(0, limits.calibration).map(hash => corpus.vectors.get(hash)) }));
        const components = initialGroups.reduce((sum, group) => sum + group.references.length + (group.calibration?.length ?? 0), 0) * corpus.dimensions;
        if (retainedComponents + components > limits.modelVectorComponents) throw new Error('neighbor_calibration_model_memory_budget');
        retainedComponents += components;
        const fitSelected = async () => {
          const groups = representative ? await selectRepresentativeNeighborGroups(splits, corpus.vectors, corpus.dimensions, { signal, consumeWork }) : initialGroups;
          const model = await fit(groups, corpus.dimensions, { signal, consumeWork });
          return { model, groups };
        };
        models.set(key, fitSelected()
          .catch(error => { models.delete(key); retainedComponents -= components; throw error; }));
      }
      const fitted = await models.get(key);
      signal?.throwIfAborted();
      return { version, snapshotId: key, status: 'evaluated',
        candidates: fitted.model.assess(corpus.vectors.get(descriptionHash)),
        ...(targets ? { referenceCoverage: measureNeighborReferenceCoverage(fitted.groups, targets, corpus.vectors.get(descriptionHash), consumeWork) } : {}) };
    },
  });
}
