/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inspectUnseenMultiScaleSource, ownMultiScaleSource } from './inventoryMultiScaleSource.mjs';

/** Release probe metadata before a full read or the independent publication read. */
async function readCachedCandidate({ repository, identity, signal, isCurrent, selectCached, setStage }) {
  setStage('snapshot_read');
  const snapshot = await repository.readVerification(identity, { signal });
  signal.throwIfAborted();
  if (!isCurrent(snapshot.state)) return null;
  setStage('source_validation');
  const cached = selectCached(snapshot.key);
  // Undefined is a valid cache miss; null means the source was invalidated.
  return cached ? { key: snapshot.key, cached, input: null } : undefined;
}

/** End the repository snapshot's lifetime before asynchronous fitting starts. */
async function readCandidate({ repository, identity, signal, isCurrent, selectCached, setStage, observeSource }) {
  setStage('snapshot_read');
  const snapshot = await repository.read(identity, { requireCompleteVectors: true, signal });
  signal.throwIfAborted();
  if (!isCurrent(snapshot.state)) return null;
  setStage('source_validation');
  const source = inspectUnseenMultiScaleSource(snapshot, identity);
  observeSource?.({ libraries: snapshot.libraries.length, documents: snapshot.corpus.documents.length,
    vectors: snapshot.vectors.size, dimensions: identity.dimensions });
  const cached = selectCached(source.key);
  return { key: source.key, cached, input: cached ? null : ownMultiScaleSource(source) };
}

/** Return no training input to the verification scope. Do not clear caller data. */
export async function buildLiveMultiScaleCandidate(options) {
  const probed = options.hasCachedModel ? await readCachedCandidate(options) : undefined;
  const candidate = probed === undefined ? await readCandidate(options) : probed;
  if (!candidate) return null;
  options.signal.throwIfAborted();
  options.setStage('profile_build');
  const built = candidate.cached ?? await options.build(candidate.input, { signal: options.signal });
  return { key: candidate.key, built, reused: Boolean(candidate.cached) };
}
