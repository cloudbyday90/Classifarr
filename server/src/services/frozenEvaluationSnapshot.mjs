/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const isMetadataRefresh = component => component === 'metadata' || component === 'observedTraits';

/** Historical validity never authorizes a live route or relaxes live cache invalidation. */
export function summarizeFrozenEvaluationSnapshot({ changedComponents = [], interrupted = false, verificationFailure = null } = {}) {
  const changed = [...new Set(changedComponents)].sort();
  const failure = verificationFailure ?? (changed.some(component => !isMetadataRefresh(component)) ? 'source_changed' : null);
  const valid = !interrupted && !failure;
  return { evaluationSnapshotValid: valid, sourceVerified: valid && changed.length === 0,
    snapshotScope: 'frozen_at_start', liveMetadataRefreshed: changed.some(isMetadataRefresh),
    verificationFailure: failure, changedComponents: changed };
}

/** Compare aggregate digests only; later reads never replace the captured evaluation inputs. */
export function createFrozenEvaluationSnapshot({ fingerprint, components }) {
  if (typeof fingerprint !== 'string' || !fingerprint || !components || !Object.keys(components).length) {
    throw new Error('frozen_evaluation_snapshot_invalid');
  }
  const initial = Object.freeze({ ...components }), changed = new Set();
  return {
    sourceComponents: initial,
    observe(current) {
      const keys = new Set([...Object.keys(initial), ...Object.keys(current.components)]);
      const delta = [...keys].filter(key => initial[key] !== current.components[key]);
      for (const key of delta) changed.add(key);
      if ([...keys].some(key => !Object.hasOwn(initial, key) || !Object.hasOwn(current.components, key))) changed.add('componentSchema');
      // A changed aggregate without changed components (or the reverse) is not enrichment.
      if (typeof current.fingerprint !== 'string' || !current.fingerprint ||
          (current.fingerprint !== fingerprint) !== (delta.length > 0)) changed.add('fingerprint');
      return summarizeFrozenEvaluationSnapshot({ changedComponents: [...changed] });
    },
    summary(options = {}) {
      return summarizeFrozenEvaluationSnapshot({ ...options, changedComponents: [...changed] });
    },
  };
}
