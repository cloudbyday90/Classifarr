/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildDescriptionBenchmarkPrompt, parseDescriptionBenchmarkProposal } from './inventoryDescriptionBenchmarkPrompt.mjs';

/** Diagnose observations, never infer correctness from agreement. */
export function identifyDescriptionDisagreements(prepared, outcomes) {
  return prepared.cases.flatMap((entry, index) => {
    const votes = outcomes[index] ?? new Map();
    const reasons = [];
    if (!entry.observedLibraryIds.some(id => entry.candidates.some(candidate => candidate.id === id))) reasons.push('observed_destination_not_shortlisted');
    if (index < outcomes.length && votes.size !== 3) reasons.push('comparison_incomplete');
    if (new Set(votes.values()).size > 1) reasons.push('answer_changed_with_budget');
    if ([...votes.values()].some(proposal => proposal > 0 && !entry.observedLibraryIds.includes(entry.candidates[proposal - 1].id))) reasons.push('answer_differs_from_placement');
    if ([...votes.values()].some(proposal => proposal === 0)) reasons.push('model_abstained');
    if (!reasons.length) return [];
    if (index >= outcomes.length) reasons.push('comparison_not_run');
    return [{ index, reasons, priority: reasons.includes('observed_destination_not_shortlisted') ? 0 : reasons.includes('answer_changed_with_budget') ? 1 : 2 }];
  }).sort((a, b) => a.priority - b.priority || a.index - b.index);
}

/** Include observed candidates without exposing their observed status to the model. */
export function buildDescriptionInvestigationCandidates(entry) {
  const available = entry.investigationCandidates ?? entry.candidates;
  const observed = available.filter(candidate => entry.observedLibraryIds.includes(candidate.id));
  if (observed.length > 3 || observed.length !== new Set(entry.observedLibraryIds).size) return null;
  const combined = [...observed, ...available.filter(candidate => !entry.observedLibraryIds.includes(candidate.id))].slice(0, 3).reverse();
  return combined.length >= 2 && combined.every(candidate => candidate.items.length > 0) ? combined : null;
}

export async function investigateDescriptionDisagreements(prepared, outcomes, {
  client, identity, context, signal, onPrivateCase, maximumRechecks = 25,
} = {}) {
  if (!Number.isInteger(maximumRechecks) || maximumRechecks < 0 || maximumRechecks > 25) throw new Error('description_investigation_budget_invalid');
  const identified = identifyDescriptionDisagreements(prepared, outcomes);
  const cases = [];
  let calls = 0, inspectionFailures = 0;
  for (const item of identified) {
    const entry = prepared.cases[item.index];
    const votes = outcomes[item.index] ?? new Map();
    const candidates = buildDescriptionInvestigationCandidates(entry);
    let status = 'not_rechecked';
    let recheckDestination = null;
    if (item.reasons.includes('comparison_not_run')) status = 'comparison_not_run';
    else if (item.reasons.includes('comparison_incomplete')) status = 'comparison_incomplete';
    else if (!candidates) status = 'scope_or_evidence_incomplete';
    else if (signal?.aborted) status = 'cancelled';
    else if (calls >= maximumRechecks) status = 'budget_deferred';
    else {
      calls++;
      try {
        const packet = buildDescriptionBenchmarkPrompt({ ...entry, candidates }, prepared.texts, 9);
        const result = await client.generate({ prompt: packet.prompt, count: candidates.length, context, identity, signal });
        const proposal = parseDescriptionBenchmarkProposal(result.response, candidates.length);
        if (result.outputLimitReached || result.contextLimitSuspected || proposal === null) status = 'invalid_or_limited';
        else if (proposal === 0) status = 'recheck_abstained';
        else {
          const chosenId = candidates[proposal - 1].id;
          recheckDestination = candidates[proposal - 1].name;
          const earlierIds = new Set([...votes.values()].filter(value => value > 0).map(value => entry.candidates[value - 1].id));
          status = earlierIds.has(chosenId) ? 'recheck_matches_an_earlier_answer' : 'recheck_changes_answer';
        }
      } catch { status = signal?.aborted ? 'cancelled' : 'recheck_failed'; }
    }
    const nextCheck = ['comparison_incomplete', 'scope_or_evidence_incomplete', 'invalid_or_limited', 'recheck_failed'].includes(status)
      ? 'technical_evidence_check' : ['budget_deferred', 'cancelled'].includes(status) ? 'resume_investigation' : 'compare_content_with_declared_library_intent';
    const record = { caseNumber: item.index + 1, reasons: item.reasons, status,
      nextCheck: status === 'comparison_not_run' ? 'run_original_comparison' : nextCheck };
    cases.push(record);
    if (onPrivateCase) {
      try { await onPrivateCase({ ...record, reasons: [...record.reasons], overview: entry.overview,
        itemIdentity: entry.itemIdentity ? { ...entry.itemIdentity } : null, recheckDestination,
        observedDestinations: (entry.investigationCandidates ?? entry.candidates).filter(candidate => entry.observedLibraryIds.includes(candidate.id)).map(candidate => candidate.name),
        candidates: (candidates ?? entry.candidates).map(candidate => ({ name: candidate.name, mediaType: candidate.media_type })),
        earlierAnswers: [...votes].map(([budget, value]) => ({ budget, destination: value === 0 ? null : entry.candidates[value - 1].name })) }); }
      catch { inspectionFailures++; }
    }
  }
  return { version: 1, flaggedCases: cases.length, comparisonsNotRun: prepared.cases.length - outcomes.length,
    recheckCalls: calls, maximumRechecks, inspectionFailures,
    verifiedLabelsCreated: 0, userQuestionsCreated: 0, routingChanged: false,
    statuses: Object.fromEntries([...new Set(cases.map(entry => entry.status))].map(status => [status, cases.filter(entry => entry.status === status).length])), cases };
}
