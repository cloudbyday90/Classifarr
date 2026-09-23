/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { collectInventoryCompanyMetadata } from './inventoryCompanyMetadata.mjs';
import { collectInventoryCandidateMetadata } from './inventoryMetadataCandidates.mjs';
import { learnInventoryCompanyProfiles, scoreInventoryCompanyProfile, INVENTORY_COMPANY_PROFILE_VERSION } from './inventoryCompanyProfiles.mjs';
import { learnInventoryProfiles, scoreInventoryProfile } from './inventoryLearnedProfiles.mjs';
import { prepareInventoryDescriptionCorpus } from './inventoryDescriptionCorpus.mjs';
import { selectDescriptionBenchmarkSample, validateDescriptionBenchmarkOptions } from './inventoryDescriptionBenchmarkSelection.mjs';
import { planDescriptionBenchmarkFolds } from './inventoryDescriptionBenchmarkFolds.mjs';

const counters = () => ({ sampled: 0, observedCompanies: 0, baselineDecisions: 0, baselineAgreements: 0,
  companyDecisions: 0, companyAgreements: 0, pairedDecisions: 0, changedDecisions: 0 });
function winner(libraries, score) {
  const ranked = libraries.map(library => ({ id: library.id, score: score(library.id) }))
    .filter(row => Number.isFinite(row.score) && row.score > 0).sort((a, b) => b.score - a.score);
  return ranked.length && ranked[0].score !== ranked[1]?.score ? ranked[0].id : null;
}

/** No AI calls or writes. Placement agreement is a diagnostic, NOT ground-truth accuracy. */
export function benchmarkInventoryCompanyProfiles({ rows, libraries }, options) {
  const validated = validateDescriptionBenchmarkOptions(options);
  if (!validated.folds || validated.generateCases) throw new Error('company_benchmark_requires_grouped_zero_generation');
  const corpus = prepareInventoryDescriptionCorpus(rows);
  const metadata = collectInventoryCandidateMetadata(rows), companies = collectInventoryCompanyMetadata(rows);
  const sample = selectDescriptionBenchmarkSample(corpus, validated);
  const plan = planDescriptionBenchmarkFolds(corpus, sample, libraries, validated);
  const foldTraining = [];
  const media = { movie: counters(), tv: counters() };
  const strata = libraries.map((library, index) => ({ stratum: index + 1, mediaType: library.media_type,
    libraryId: library.id, ...counters() }));
  for (const [fold, held] of plan.held.entries()) {
    // Release each bounded pair before fitting the next fold; do not retain up to 20 models.
    const model = { baseline: learnInventoryProfiles(corpus.documents, metadata, libraries, held),
      companies: learnInventoryCompanyProfiles(corpus.documents, companies, libraries, held) };
    foldTraining.push({ baseline: model.baseline.summary.trainingDescriptions,
      companies: model.companies.summary.trainingDescriptions });
    for (const doc of sample.filter(item => plan.foldByHash.get(item.hash) === fold)) {
      const candidates = libraries.filter(library => library.media_type === doc.type);
      const baseline = winner(candidates, id => scoreInventoryProfile(model.baseline, id, metadata.get(doc.key)));
      const company = winner(candidates, id => scoreInventoryCompanyProfile(model.companies, id, companies.get(doc.key)));
      const paired = baseline !== null && company !== null;
      const values = { sampled: 1, observedCompanies: Number(Boolean(companies.get(doc.key)?.productionCompanies.length)),
        baselineDecisions: Number(baseline !== null), baselineAgreements: Number(doc.libraryIds.includes(baseline)),
        companyDecisions: Number(company !== null), companyAgreements: Number(doc.libraryIds.includes(company)),
        pairedDecisions: Number(paired), changedDecisions: Number(paired && baseline !== company) };
      for (const target of [media[doc.type], ...strata.filter(stratum => doc.libraryIds.includes(stratum.libraryId))]) {
        for (const [key, value] of Object.entries(values)) target[key] += value;
      }
    }
  }
  return { version: INVENTORY_COMPANY_PROFILE_VERSION, metric: 'held_out_inventory_placement_agreement_not_accuracy',
    sampleSize: sample.length, requestedSize: validated.size, folds: validated.folds,
    fingerprint: createHash('sha256').update(JSON.stringify([validated.seed, corpus.documents,
      [...metadata], [...companies], libraries.map(({ id, media_type }) => ({ id, media_type }))])).digest('hex'),
    media, libraries: strata.map(({ libraryId: _privateId, ...stratum }) => stratum),
    foldTraining,
    independentOutcomeLabels: 0, routingChanges: 0, providerCalls: 0 };
}
