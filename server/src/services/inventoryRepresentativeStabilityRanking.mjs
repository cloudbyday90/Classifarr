/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { rankInventoryRepresentativeEvidence } from './inventoryRepresentativeGroups.mjs';
import { rankInventoryEvidence } from './inventoryEvidenceReranker.mjs';
import { REPRESENTATIVE_STABILITY_STARTS } from './inventoryRepresentativeStability.mjs';

/** Offline sensitivity check. Never treats agreement between fits as route authority. */
export function rankStableInventoryRepresentativeEvidence(model, row) {
  if (!model.legacyLibraries || model.startLibraries?.length !== REPRESENTATIVE_STABILITY_STARTS) {
    throw new Error('inventory_representative_stability_model_required');
  }
  // Shared scorer validates the full media pool and exact held-out set first.
  const selected = rankInventoryRepresentativeEvidence(model, row);
  const legacy = rankInventoryRepresentativeEvidence({ ...model, libraries: model.legacyLibraries }, row);
  const diagnostics = { selectedRanking: selected.ranking, legacyRanking: legacy.ranking };
  if (['consensus', 'ambiguous'].includes(selected.status)) return { ...selected, ...diagnostics };
  const baseline = rankInventoryEvidence(row.candidates);
  const fits = row.candidates.map(candidate => model.coverage.get(candidate.id)?.stability?.starts);
  if (fits.some(starts => starts?.length !== REPRESENTATIVE_STABILITY_STARTS || starts.some(start => !start.converged))) {
    return { ranking: baseline, status: 'unconverged_groups', ...diagnostics };
  }
  const alternatives = model.startLibraries.map(libraries => rankInventoryRepresentativeEvidence({ ...model, libraries }, row));
  const views = [selected, ...alternatives];
  if (views.some(view => view.status !== 'scored')) return { ranking: baseline, status: 'initialization_unavailable', ...diagnostics };
  if (new Set(views.map(view => view.ranking[0])).size !== 1) return { ranking: baseline, status: 'initialization_sensitive', ...diagnostics };
  return { ...selected, ...diagnostics };
}
