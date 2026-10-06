/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inspectUnseenMultiScaleSource, ownMultiScaleSource } from '../../services/inventoryMultiScaleSource.mjs';
import { normalizeDescriptionVector } from '../../services/inventoryDescriptionSimilarity.mjs';

/** Diagnostic allocation control, not a production pipeline or worker benchmark. */
export async function measureVectorCopies({ fixture, metrics }) {
  const retained = { snapshot: await fixture.repository.read(fixture.identity, { requireCompleteVectors: true }) };
  const dimensions = fixture.identity.dimensions;
  await metrics.settled('copies_snapshot');
  retained.owned = ownMultiScaleSource(inspectUnseenMultiScaleSource(retained.snapshot, fixture.identity));
  await metrics.settled('copies_owned');
  retained.clone = structuredClone(retained.owned.training.vectors);
  await metrics.settled('copies_clone');
  const normalize = () => new Map([...retained.owned.training.vectors]
    .map(([hash, vector]) => [hash, normalizeDescriptionVector(vector, dimensions)]));
  retained.normalized = normalize();
  await metrics.settled('copies_normalized');
  retained.duplicate = normalize();
  await metrics.settled('copies_duplicate');
  // Use every retained map after sampling, so collection cannot discard an earlier copy.
  const maps = [retained.snapshot.vectors, retained.owned.training.vectors,
    retained.clone, retained.normalized, retained.duplicate];
  await metrics.mark('copies_retained', { vectorCounts: maps.map(map => map.size), dimensions });
}
