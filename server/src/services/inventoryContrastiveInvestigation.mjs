/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { compareInventoryDescription } from './inventoryDescriptionBenchmarkComparison.mjs';
import { validateDescriptionBenchmarkOptions } from './inventoryDescriptionBenchmarkSelection.mjs';
import { selectContrastiveLibraryExamples } from './inventoryContrastiveExamples.mjs';
import { planContrastiveInvestigationCases } from './inventoryContrastiveCasePlan.mjs';
import { summarizeContrastiveResults, summarizeContrastivePairs } from './inventoryContrastiveReport.mjs';

/** Controlled local investigation. Outcomes remain observations, never training labels. */
export async function runContrastiveInventoryInvestigation(prepared, settings, { client, identity, signal, onProgress = () => {} } = {}) {
  const options = validateDescriptionBenchmarkOptions(settings);
  if (!options.folds || !prepared.evaluation || !(prepared.vectors instanceof Map)) throw new Error('contrastive_investigation_requires_folds');
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60000), ...(signal ? [signal] : [])]);
  const requested = Math.min(options.generateCases, prepared.cases.length);
  let calls = 0;
  const compare = (entry, anonymousLibraries = false) => compareInventoryDescription(entry, prepared.texts, {
    client, identity, context: options.context, signal: abort, anonymousLibraries, onCall: () => calls++,
  });
  const baseline = [];
  for (let index = 0; index < requested && !abort.aborted; index++) {
    baseline.push(await compare(prepared.cases[index]));
    onProgress({ stage: 'baseline', completed: baseline.length, requested, calls });
  }
  const plan = planContrastiveInvestigationCases(prepared, baseline);
  const arms = ['ordinary_anonymous', 'contrastive_named', 'contrastive_anonymous'].map(id => ({ id, disagreements: [], controls: [] }));
  const selected = [...plan.disagreements.map(index => ({ index, group: 'disagreements' })),
    ...plan.controls.map(index => ({ index, group: 'controls' }))];
  const evidence = {};
  let replacedExamples = 0, completedCases = 0;
  for (const [ordinal, { index, group }] of selected.entries()) {
    if (abort.aborted) break;
    const entry = prepared.cases[index];
    const contrastive = selectContrastiveLibraryExamples(entry, prepared.vectors);
    evidence[contrastive.status] = (evidence[contrastive.status] ?? 0) + 1;
    replacedExamples += contrastive.summary?.replacedExamples ?? 0;
    for (let offset = 0; offset < arms.length && !abort.aborted; offset++) {
      const arm = arms[(ordinal + offset) % arms.length];
      const ordinary = arm.id === 'ordinary_anonymous';
      const result = !ordinary && contrastive.status !== 'available' ? { status: 'evidence_unavailable' }
        : await compare(ordinary ? entry : { ...entry, candidates: contrastive.candidates }, arm.id !== 'contrastive_named');
      arm[group].push({ ...result, changed: ['proposed', 'abstained'].includes(result.status) && result.destinationId !== baseline[index].destinationId });
    }
    completedCases++;
    onProgress({ stage: 'investigation', completed: completedCases, requested: selected.length, calls });
  }
  const allResults = [...baseline, ...arms.flatMap(arm => [...arm.disagreements, ...arm.controls])];
  const errors = allResults.some(result => !['proposed', 'abstained'].includes(result.status));
  return { version: 1, protocol: 'contrastive_library_investigation_v1',
    status: options.generateCases === 0 ? 'preflight' : abort.aborted ? 'interrupted' : errors ? 'completed_with_errors' : 'complete',
    seed: options.seed, snapshotFingerprint: prepared.fingerprint, sampleFingerprint: prepared.sampleFingerprint,
    sampledTitles: prepared.cases.length, sampleShortfall: Math.max(0, options.size - prepared.cases.length),
    excludedPriorDescriptions: prepared.excludedPriorDescriptions ?? 0, evaluation: prepared.evaluation,
    profileLearning: prepared.profileLearning, metadataSelection: prepared.metadataSelection,
    independentLabels: 0, accuracy: null, observedPlacementIsGroundTruth: false, liveRoutingChanged: false,
    verifiedLabelsCreated: 0, userQuestionsCreated: 0, inputTruncation: 'unknown',
    generation: identity ? { model: identity.model, digest: identity.digest, context: options.context, temperature: 0, seed: 42, thinking: false, outputLimit: 64 } : null,
    requestedGenerationCases: options.generateCases, baseline: summarizeContrastiveResults(baseline),
    selection: plan.summary, calls, maximumCalls: requested + 600, evidence, replacedExamples,
    confusionPairs: summarizeContrastivePairs(prepared, baseline),
    arms: arms.map(arm => ({ id: arm.id, disagreements: { ...summarizeContrastiveResults(arm.disagreements),
      changed: arm.disagreements.filter(result => result.changed).length },
    controls: { ...summarizeContrastiveResults(arm.controls), lostAgreement: arm.controls.filter(result =>
      ['proposed', 'abstained'].includes(result.status) && !result.agreement).length } })),
  };
}
