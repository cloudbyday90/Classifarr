/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { getPool } from '../integration/setup.mjs';
import { createReadinessDatabase } from './readinessDatabase.mjs';
import { createAdjudicationBudgetWorkerFixture } from './adjudicationBudgetWorkerFixture.mjs';
import { resourceAdmissionFixture } from './resourceAdmissionFixture.mjs';
import { createInventoryDiscoveryAdmission } from '../../services/inventoryDiscoveryAdmission.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';

export const ownedCaptureMemory = () => ({ available: 4e9, constrained: 8e9, total: 8e9 });
export const ownedCaptureSnapshot = async () => ({ budget: (await getPool().query('SELECT * FROM adjudication_capture_budget')).rows,
  cached: (await getPool().query('SELECT * FROM cached_adjudication_batch')).rows });

/** Real pool, discovery lock and resource policy; synthetic retained responses, no provider. */
export async function createOwnedCaptureFixture() {
  const f = await createAdjudicationBudgetWorkerFixture(), db = createReadinessDatabase({ max: 2 });
  const budget = createAdjudicationBudgetRepository(db), resources = resourceAdmissionFixture(ownedCaptureMemory);
  try {
    const state = await budget.configure({ dailyCalls: 5, dailyTokens: 42240 });
    const plan = [{ key: 'c'.repeat(64), prompt: 'Synthetic comparison', count: 2 }];
    const checkpoint = budget.checkpoint(state.revision);
    await checkpoint.open(plan, { version: 'cached_adjudication.v1', configuration: 'a'.repeat(64),
      identity: { model: 'synthetic:latest', digest: 'b'.repeat(64), contextLength: 8192 }, records: [] });
    await budget.reserve(state.revision);
    await checkpoint.record({ key: plan[0].key, generated: { response: 'Synthetic response', latencyMs: 1,
      promptTokens: 10, outputTokens: 10, outputLimitReached: false, contextLimitSuspected: false, inputTruncation: 'unknown' } });
    await checkpoint.publish();
    f.capture.mockImplementation(async (_options, dependencies) => {
      await dependencies.onPublished(f.prepared.fingerprint, true, new AbortController().signal);
      return { calls: 0, reused: 1, stored: 1 };
    });
    const admission = createInventoryDiscoveryAdmission({ ...db, readMemory: ownedCaptureMemory, resourceAdmission: resources });
    const finish = jest.spyOn(budget, 'finish');
    return { ...f, db, budget, state, resources, admission, finish, before: await ownedCaptureSnapshot(),
      createWorker: (overrides = {}) => createAdjudicationBudgetWorker({ ...f.dependencies, budget, withAdmission: admission, ...overrides }) };
  } catch (error) { await db.pool.end(); throw error; }
}
