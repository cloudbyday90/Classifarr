/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sourcePairFixture, sourcePairIdentity } from './sourceDescriptionPairFixture.mjs';
import { executeAutomaticSourcePair } from '../../services/automaticSourcePairExecution.mjs';
import { createCachedAdjudicationReport } from '../../services/cachedAdjudicationReport.mjs';

export async function sourcePairWindowFixture(count = 48) {
  const source = sourcePairFixture(count);
  source.evaluationRows = source.rows.map(row => ({ ...row, title: 'Synthetic item', year: 2020 }));
  source.rows = source.evaluationRows;
  source.policies = source.libraries.map(library => ({ id: library.id, library_id: library.id, enabled: true,
    name: 'Synthetic policy', library_name: library.name, library_media_type: library.media_type, priority: 1,
    auto_classify_threshold: 85, prompt_threshold: 60, profile_weight: .5, rag_weight: .5,
    trust_rag: true, trust_patterns: false, trust_history: false, presets: [] }));
  source.policySourceRevisionRows = source.policies.map(policy => ({ policy_id: policy.id,
    media_type: policy.library_media_type, source_updated_at: '2026-09-01', mutable_attachment: false }));
  source.adjudicationSelectionOffset = 0;
  const snapshot = { observedAt: new Date().toISOString(), adjudicationBudgetRevision: 0,
    inputs: { source, identity: sourcePairIdentity, configuration: 'test' } };
  const result = await executeAutomaticSourcePair(snapshot, null);
  return { snapshot, result };
}

/** Synthetic aggregate for boundary tests; not evidence of classifier accuracy. */
export function completedWindowReport(base, { eligible = 48, offset = 0, selected = Math.min(25, eligible - offset), kind = 'automatic' } = {}) {
  const replay = createCachedAdjudicationReport();
  Object.assign(replay, { eligible, selected, selectionOffset: offset, budgetSkipped: eligible - selected,
    paired: kind === 'invalid' ? 0 : selected });
  replay[kind === 'automatic' ? 'deterministicPairs' : kind === 'mixed' ? 'mixedPairs' : 'aiPairs'] = replay.paired;
  for (const [index, arm] of [replay.baseline, replay.sourceAware].entries()) {
    if (kind === 'automatic' || (kind === 'mixed' && index === 0)) arm.automatic = selected;
    else { arm.hits = selected; arm[kind === 'invalid' ? 'invalid' : 'abstained'] = selected; }
  }
  return { ...structuredClone(base), aiReplay: replay };
}
