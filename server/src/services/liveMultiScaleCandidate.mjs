/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inspectUnseenMultiScaleSource, ownMultiScaleSource } from './inventoryMultiScaleSource.mjs';

/** End the repository snapshot's lifetime before asynchronous fitting starts. */
async function readCandidate({ repository, identity, signal, isCurrent, selectCached, setStage }) {
  setStage('snapshot_read');
  const snapshot = await repository.read(identity, { requireCompleteVectors: true });
  signal.throwIfAborted();
  if (!isCurrent(snapshot.state)) return null;
  setStage('source_validation');
  const source = inspectUnseenMultiScaleSource(snapshot, identity);
  const cached = selectCached(source.key);
  return { key: source.key, cached, input: cached ? null : ownMultiScaleSource(source) };
}

/** Return no training input to the verification scope. Do not clear caller data. */
export async function buildLiveMultiScaleCandidate(options) {
  const candidate = await readCandidate(options);
  if (!candidate) return null;
  options.signal.throwIfAborted();
  options.setStage('profile_build');
  const built = candidate.cached ?? await options.build(candidate.input, { signal: options.signal });
  return { key: candidate.key, built, reused: Boolean(candidate.cached) };
}
