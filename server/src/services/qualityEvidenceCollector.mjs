/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createQualityEvidenceRepository } from './qualityEvidenceRepository.mjs';
import { runSourcePairQualityThread } from './sourcePairQualityThreadClient.mjs';

/** Caller holds shared discovery admission. Failure preserves capture; known drift releases it. */
export async function collectActiveQualityStudy(database, snapshot, signal, runThread = runSourcePairQualityThread) {
  const repository = createQualityEvidenceRepository(database), state = await repository.read(signal);
  if (!state || state.status !== 'active') return state;
  let observation;
  try { observation = await runThread(snapshot, state.protocol, null, { signal, operation: 'collect' }); }
  catch (error) {
    if (!['quality_cohort_changed', 'quality_evidence_changed'].includes(error.message)) throw error;
    await repository.drift(state, signal); return { ...state, status: 'drifted' };
  }
  return repository.merge(state, observation, signal);
}
