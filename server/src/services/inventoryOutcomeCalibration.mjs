/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { collectInventoryCandidateMetadata } from './inventoryMetadataCandidates.mjs';
import { collectInventoryCompanyMetadata } from './inventoryCompanyMetadata.mjs';
import { learnInventoryCompanyProfiles, scoreInventoryCompanyProfile } from './inventoryCompanyProfiles.mjs';
import { learnInventoryProfiles, scoreInventoryProfile } from './inventoryLearnedProfiles.mjs';
import { prepareInventoryDescriptionCorpus } from './inventoryDescriptionCorpus.mjs';
import { selectDescriptionBenchmarkSample, validateDescriptionBenchmarkOptions } from './inventoryDescriptionBenchmarkSelection.mjs';
import { planDescriptionBenchmarkFolds } from './inventoryDescriptionBenchmarkFolds.mjs';
import { prepareInventoryOutcomeLabels } from './inventoryOutcomeLabels.mjs';

const empty = () => ({ sampled: 0, confirmations: 0, corrections: 0, companyObserved: 0,
  baselineDecisions: 0, baselineMatches: 0, combinedDecisions: 0, combinedMatches: 0,
  pairedDecisions: 0, gains: 0, regressions: 0, changed: 0,
  correctionGains: 0, correctionRegressions: 0, confirmationGains: 0, confirmationRegressions: 0 });

/** Scores are diagnostic contrasts, not calibrated probabilities or route authorization. */
function choose(candidates, score) {
  const ranked = candidates.map(library => ({ id: library.id, score: score(library.id) }))
    .filter(row => Number.isFinite(row.score) && row.score > 0)
    .sort((a, b) => b.score - a.score || a.id - b.id);
  return ranked.length && ranked[0].score !== ranked[1]?.score ? ranked[0].id : null;
}

function record(target, label, observed, baseline, combined) {
  target.sampled++;
  target[label.kind === 'correction' ? 'corrections' : 'confirmations']++;
  target.companyObserved += Number(observed);
  target.baselineDecisions += Number(baseline !== null);
  target.baselineMatches += Number(baseline === label.libraryId);
  target.combinedDecisions += Number(combined !== null);
  target.combinedMatches += Number(combined === label.libraryId);
  target.pairedDecisions += Number(baseline !== null && combined !== null);
  target.gains += Number(baseline !== label.libraryId && combined === label.libraryId);
  target.regressions += Number(baseline === label.libraryId && combined !== label.libraryId);
  target.changed += Number(baseline !== combined);
  const prefix = label.kind === 'correction' ? 'correction' : 'confirmation';
  target[`${prefix}Gains`] += Number(baseline !== label.libraryId && combined === label.libraryId);
  target[`${prefix}Regressions`] += Number(baseline === label.libraryId && combined !== label.libraryId);
}

/** Shadow-only, grouped evaluation on operator selections still present in current inventory. */
export function benchmarkInventoryOutcomeCalibration({ rows, libraries, feedbackRows }, rawOptions) {
  const options = validateDescriptionBenchmarkOptions(rawOptions);
  if (!options.folds || options.generateCases) throw new Error('inventory_outcome_requires_grouped_zero_generation');
  if (!Array.isArray(libraries) || libraries.length > 64 ||
      libraries.some(library => !Number.isInteger(library.id) || !['movie', 'tv'].includes(library.media_type))) {
    throw new Error('inventory_outcome_library_budget');
  }
  const corpus = prepareInventoryDescriptionCorpus(rows);
  const metadata = collectInventoryCandidateMetadata(rows);
  const companies = collectInventoryCompanyMetadata(rows);
  const { labels, coverage } = prepareInventoryOutcomeLabels(feedbackRows, corpus.documents, libraries);
  const labeled = corpus.documents.filter(doc => labels.has(doc.key))
    .map(doc => ({ ...doc, libraryIds: [labels.get(doc.key).libraryId] }));
  const sample = selectDescriptionBenchmarkSample({ documents: labeled }, options);
  const media = { movie: empty(), tv: empty() };
  const strata = libraries.map((library, index) => ({ stratum: index + 1, mediaType: library.media_type, ...empty() }));
  if (!sample.length) return { protocol: 'inventory_operator_outcome_shadow_v1', status: 'no_eligible_labels',
    requestedSize: options.size, sampleSize: 0, labelCoverage: coverage, media, libraries: strata,
    promotionAllowed: false, routingChanges: 0, providerCalls: 0 };
  const plan = planDescriptionBenchmarkFolds(corpus, sample, libraries, options);
  const foldTraining = [];
  for (const [fold, held] of plan.held.entries()) {
    const baselineModel = learnInventoryProfiles(corpus.documents, metadata, libraries, held);
    const companyModel = learnInventoryCompanyProfiles(corpus.documents, companies, libraries, held);
    foldTraining.push({ baseline: baselineModel.summary.trainingDescriptions,
      companies: companyModel.summary.trainingDescriptions });
    for (const doc of sample.filter(item => plan.foldByHash.get(item.hash) === fold)) {
      const label = labels.get(doc.key), candidates = libraries.filter(library => library.media_type === doc.type);
      const base = id => scoreInventoryProfile(baselineModel, id, metadata.get(doc.key));
      const company = id => scoreInventoryCompanyProfile(companyModel, id, companies.get(doc.key));
      const baseline = choose(candidates, base);
      // A fixed diagnostic weight, deliberately not optimized on these held-out labels.
      const combined = choose(candidates, id => base(id) + 0.25 * (company(id) ?? 0));
      const observed = Boolean(companies.get(doc.key)?.productionCompanies.length);
      record(media[doc.type], label, observed, baseline, combined);
      record(strata.find((_, index) => libraries[index].id === label.libraryId), label, observed, baseline, combined);
    }
  }
  return { protocol: 'inventory_operator_outcome_shadow_v1', status: 'diagnostic_only',
    requestedSize: options.size, sampleSize: sample.length, folds: options.folds,
    labelCoverage: coverage, media, libraries: strata, foldTraining,
    evaluation: { groupedBy: 'description_hash_across_media_and_identity',
      fixedCompanyWeight: 0.25, labelSource: 'eligible_operator_feedback',
      confirmationsMayBeSuggestionBiased: true, currentInventoryMayContainLaterPlacement: true,
      notFullPipelineAccuracy: true }, promotionAllowed: false, routingChanges: 0, providerCalls: 0 };
}
