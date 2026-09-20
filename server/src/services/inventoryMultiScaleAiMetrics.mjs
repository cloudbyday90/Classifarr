/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const arm = name => ({ name, selected: 0, abstained: 0, orderSensitive: 0, placementAgreements: 0 });
const counters = (secondArm) => ({ sampled: 0, ready: 0, rawExamples: 0, compactExamples: 0, compactContextExamples: 0,
  evidencePoolExamples: 0, compactEmptyCandidates: 0, emptyCandidates: 0, shortlistMisses: 0,
  contextBudgetExceeded: 0, generatedPairs: 0, changedStableChoice: 0, gainedPlacementAgreement: 0, lostPlacementAgreement: 0,
  arms: [arm('raw'), arm(secondArm)] });

/** Anonymous strata and totals only. Never retain packets, responses, titles or item keys. */
export function createMultiScaleAiMetrics(libraries, secondArm = 'compact') {
  const strata = [...libraries].sort((a, b) => a.id - b.id);
  const result = { ...counters(secondArm), mediaTypes: ['movie', 'tv'].map(mediaType => ({ mediaType, ...counters(secondArm) })),
    libraries: strata.map((row, index) => ({ stratum: index + 1, mediaType: row.media_type, ...counters(secondArm) })) };
  const targets = doc => [result, result.mediaTypes.find(row => row.mediaType === doc.type),
    ...strata.flatMap((row, index) => doc.libraryIds.includes(row.id) ? [result.libraries[index]] : [])];
  return {
    prepare(doc, plan, overBudget) {
      for (const row of targets(doc)) {
        row.sampled++;
        if (plan.status !== 'ready') continue;
        row.ready++;
        for (const key of ['rawExamples', 'compactExamples', 'compactContextExamples', 'evidencePoolExamples', 'compactEmptyCandidates']) row[key] += plan[key];
        row.emptyCandidates += plan.emptyCandidates; row.shortlistMisses += Number(plan.shortlistMiss);
        row.contextBudgetExceeded += Number(overBudget);
      }
    },
    record(doc, choices) {
      for (const row of targets(doc)) {
        row.generatedPairs++;
        const agrees = choices.map(choice => choice.status === 'selected' && doc.libraryIds.includes(choice.id));
        choices.forEach((choice, index) => {
          row.arms[index][choice.status === 'selected' ? 'selected' : choice.status === 'abstained' ? 'abstained' : 'orderSensitive']++;
          row.arms[index].placementAgreements += Number(agrees[index]);
        });
        if (choices.every(choice => choice.status !== 'order_sensitive')) {
          row.changedStableChoice += Number(choices[0].id !== choices[1].id);
          row.gainedPlacementAgreement += Number(!agrees[0] && agrees[1]);
          row.lostPlacementAgreement += Number(agrees[0] && !agrees[1]);
        }
      }
    },
    read: () => structuredClone(result),
  };
}
