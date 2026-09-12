/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { summarizeContentFirstPairs, summarizeContentFirstStrata } from './inventoryContentFirstReport.mjs';
import { INVENTORY_CONFLICT_RECHECK_RULE } from './inventoryEvidenceConflictRecheck.mjs';

const rename = ({ namedAgreed, anonymousAgreed, ...summary }) => ({ ...summary,
  baselineAgreed: namedAgreed, selectedAgreed: anonymousAgreed });

/** No private IDs, per-item decisions, retrieved text or inferred metadata terms. */
export function summarizeSelectiveInventoryRecheck(prepared, pairs, requested, decisions) {
  const strata = summarizeContentFirstStrata(prepared, pairs, requested);
  return { rule: INVENTORY_CONFLICT_RECHECK_RULE,
    selection: { ...rename(summarizeContentFirstPairs(pairs, requested)),
      evaluated: decisions.length, triggered: decisions.filter(decision => decision.shouldRecheck).length,
      accepted: pairs.filter(pair => pair.named && pair.anonymous && pair.named !== pair.anonymous).length,
      reasons: Object.fromEntries(['evidence_incomplete', 'proposal_unavailable', 'no_joint_conflict', 'joint_inventory_conflict']
        .map(reason => [reason, decisions.filter(decision => decision.reason === reason).length])) },
    strata: { media: strata.media.map(rename), libraries: strata.libraries.map(rename) } };
}
