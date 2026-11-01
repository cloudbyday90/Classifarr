/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { createAutomaticSourcePairWorkers } from '../services/automaticSourcePairWorkers.mjs';
import { createInventoryDescriptionRefreshRuntime } from '../services/inventoryDescriptionRefreshScheduler.mjs';
import { createInventoryRepresentativeProfileRuntime } from '../services/inventoryRepresentativeProfileScheduler.mjs';
import { createLiveMultiScaleRuntime } from '../services/liveMultiScaleScheduler.mjs';
import { READINESS_SCOPES } from '../utils/databaseReadinessAdmission.mjs';

test.each([
    ['source pair and adjudication', createAutomaticSourcePairWorkers, null],
    ['descriptions', createInventoryDescriptionRefreshRuntime, READINESS_SCOPES.DESCRIPTION],
    ['representative profiles', createInventoryRepresentativeProfileRuntime, READINESS_SCOPES.REPRESENTATIVE],
    ['comparison context', createLiveMultiScaleRuntime, null],
])('%s production runtime stays inert while fresh setup is incomplete', async (_name, create, scope) => {
    const query = jest.fn(async () => ({ rows: [{ readiness: 'waiting_for_inventory' }] }));
    const db = { query: jest.fn(), withTransaction: jest.fn(fn => fn({ query })), withSessionAdvisoryLock: jest.fn() };
    const runtime = create(db);
    expect(query).not.toHaveBeenCalled();
    expect(await runtime.run()).toEqual({ status: 'deferred', reason: 'waiting_for_inventory' });
    // Scoped refreshes delegate timeout setup to the production read runner;
    // the two non-opted-in runtimes retain their original SET + SELECT callback.
    expect(query).toHaveBeenCalledTimes(scope ? 1 : 2);
    if (scope) expect(db.withTransaction).toHaveBeenCalledWith(expect.any(Function), {
        signal: expect.any(AbortSignal), readOnly: true, timeoutMs: 3000, readinessScope: scope,
    });
    else expect(db.withTransaction.mock.calls[0]).toHaveLength(1);
    expect(db.query).not.toHaveBeenCalled(); expect(db.withSessionAdvisoryLock).not.toHaveBeenCalled();
    runtime.stop(); expect(await runtime.run()).toEqual({ status: 'stopped' });
});
