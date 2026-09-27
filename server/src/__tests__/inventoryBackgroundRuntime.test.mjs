/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { createAutomaticSourcePairWorkers } from '../services/automaticSourcePairWorkers.mjs';
import { createInventoryDescriptionRefreshRuntime } from '../services/inventoryDescriptionRefreshScheduler.mjs';
import { createInventoryRepresentativeProfileRuntime } from '../services/inventoryRepresentativeProfileScheduler.mjs';
import { createLiveMultiScaleRuntime } from '../services/liveMultiScaleScheduler.mjs';

test.each([
    ['source pair and adjudication', createAutomaticSourcePairWorkers],
    ['descriptions', createInventoryDescriptionRefreshRuntime],
    ['representative profiles', createInventoryRepresentativeProfileRuntime],
    ['comparison context', createLiveMultiScaleRuntime],
])('%s production runtime stays inert while fresh setup is incomplete', async (_name, create) => {
    const query = jest.fn(async () => ({ rows: [{ readiness: 'waiting_for_inventory' }] }));
    const db = { query: jest.fn(), withTransaction: fn => fn({ query }), withSessionAdvisoryLock: jest.fn() };
    const runtime = create(db);
    expect(query).not.toHaveBeenCalled();
    expect(await runtime.run()).toEqual({ status: 'deferred', reason: 'waiting_for_inventory' });
    expect(query).toHaveBeenCalledTimes(2);
    expect(db.query).not.toHaveBeenCalled(); expect(db.withSessionAdvisoryLock).not.toHaveBeenCalled();
    runtime.stop(); expect(await runtime.run()).toEqual({ status: 'stopped' });
});
