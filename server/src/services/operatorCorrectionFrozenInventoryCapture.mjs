/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluateFreshInventoryPolicyCase } from './freshInventoryPolicyPreparation.mjs';
import { validateFrozenInventoryInput } from './operatorCorrectionFrozenInventoryInput.mjs';

/** Freeze the current release's exact label-blind retrieval request, not a hand-picked shortlist. */
export async function captureOperatorCorrectionFrozenInventoryInput({ policyInput, prepared, source, evidence,
  signal, evaluate = evaluateFreshInventoryPolicyCase }) {
  if (policyInput?.version !== 2 || !Array.isArray(prepared?.cases) ||
      prepared.cases.length !== policyInput.cases?.length) throw new Error('frozen_inventory_capture_invalid');
  const cases = [];
  for (const [index, sample] of prepared.cases.entries()) {
    signal?.throwIfAborted();
    const runtime = evidence.forCase(sample);
    if (!runtime || typeof runtime.retrieve !== 'function') throw new Error('frozen_inventory_capture_case_unavailable');
    let captured = null;
    let violation = false;
    const retriever = { async retrieve(request) {
      if (captured || request?.contract?.valid !== true || !Array.isArray(request.contract.candidates) ||
          request.contract.candidates.some(candidate => candidate.mediaType !== sample.mediaType)) {
        violation = true;
        throw new Error('frozen_inventory_capture_contract_invalid');
      }
      const contract = request.contract.candidates.map(candidate => candidate.libraryId);
      try {
        const result = await runtime.retrieve(request);
        captured = { statusId: 'captured', contract, evidence: result };
        return result;
      } catch (error) {
        violation = true;
        throw error;
      }
    } };
    await evaluate(sample, source, evidence, signal, { retriever });
    if (violation) throw new Error('frozen_inventory_capture_contract_invalid');
    cases.push({ ...policyInput.cases[index], inventory: captured ??
      { statusId: 'not_requested', contract: null, evidence: null } });
  }
  return validateFrozenInventoryInput({ ...policyInput, version: 3, cases });
}
