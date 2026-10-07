/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createInventoryRepresentativeShadow } from '../../services/inventoryRepresentativeShadow.mjs';
import { createInventoryNeighborhoodRecovery } from '../../services/inventoryNeighborhoodRecovery.mjs';
import { assertStudyProviderEnvironment } from '../resourceStudyProviderFixture.mjs';
import { enqueueComparisonStudyQueries } from './consumerQueries.mjs';

/** Actual production consumers; only input generation and numeric observation are study-specific. */
export function createComparisonStudyConsumers({ metrics, now = Date.now, getRevision = () => 0 }) {
  assertStudyProviderEnvironment();
  const shadow = createInventoryRepresentativeShadow({ now });
  const recovery = createInventoryNeighborhoodRecovery({ now, getRevision });
  const counts = { shadowPrepared: 0, shadowCommitted: 0, neighborhoodPrepared: 0, neighborhoodCommitted: 0, errors: 0 };
  let batches = 0, stopped = false;
  const mark = (kind, stage) => metrics.markSync(`recovery_${kind}_${stage}`);
  // Outside prepare's lexical scope: don't retain context/snapshot/model through a commit wrapper.
  const instrumentBatch = (batch, kind) => {
    if (!batch) return null;
    metrics.track(kind === 'shadow' ? 'shadowBatch' : 'neighborhoodBatch', batch);
    let committed = false;
    return { commit(fresh) {
      if (committed) return; committed = true;
      try {
        mark(kind, 'commit_start'); batch.commit(fresh); counts[`${kind}Committed`]++;
        mark(kind, 'commit_end');
      } catch (error) { counts.errors++; throw error; }
    } };
  };
  return {
    observer: { ...shadow, prepare(context) {
      try {
        assert.ok(!stopped && batches < 60, 'comparison_consumer_batch_budget');
        mark('shadow', 'prepare_start');
        enqueueComparisonStudyQueries(shadow, context, ++batches);
        metrics.track('representativeModel', context.model);
        const batch = shadow.prepare(context); counts.shadowPrepared++;
        mark('shadow', 'prepare_end');
        return instrumentBatch(batch, 'shadow');
      } catch (error) { counts.errors++; throw error; }
    } },
    neighborhoodRecovery: { ...recovery, async prepare(context) {
      try {
        mark('neighborhood', 'prepare_start');
        const batch = await recovery.prepare(context); counts.neighborhoodPrepared++;
        mark('neighborhood', 'prepare_end');
        return instrumentBatch(batch, 'neighborhood');
      } catch (error) { counts.errors++; throw error; }
    } },
    read() {
      const report = shadow.read(), readiness = recovery.readReadiness();
      return { ...counts, processed: Object.values(report.latency).reduce((sum, n) => sum + n, 0),
        invalidInputs: report.counts.invalid_input, pending: report.pending,
        groups: readiness?.groups ?? 0, routingAffected: report.routingAffected, stopped };
    },
    stop() { stopped = true; shadow.stop(); recovery.clear(); },
  };
}
