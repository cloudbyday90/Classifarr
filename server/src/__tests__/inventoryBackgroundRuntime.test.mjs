/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { createAutomaticSourcePairWorkers } from '../services/automaticSourcePairWorkers.mjs';
import { createInventoryDescriptionRefreshRuntime } from '../services/inventoryDescriptionRefreshScheduler.mjs';
import { createInventoryRepresentativeProfileRuntime } from '../services/inventoryRepresentativeProfileScheduler.mjs';
import { createLiveMultiScaleRuntime } from '../services/liveMultiScaleScheduler.mjs';
import { READINESS_SCOPES } from '../utils/databaseReadinessAdmission.mjs';

test.each([
    ['source pair and adjudication', createAutomaticSourcePairWorkers, READINESS_SCOPES.SOURCE_PAIR],
    ['descriptions', createInventoryDescriptionRefreshRuntime, READINESS_SCOPES.DESCRIPTION],
    ['representative profiles', createInventoryRepresentativeProfileRuntime, READINESS_SCOPES.REPRESENTATIVE],
    ['comparison context', createLiveMultiScaleRuntime, null],
])('%s production runtime stays inert while fresh setup is incomplete', async (_name, create, scope) => {
    const query = jest.fn(async () => ({ rows: [{ readiness: 'waiting_for_inventory' }] }));
    const db = { query: jest.fn(), withTransaction: jest.fn(fn => fn({ query })), withSessionAdvisoryLock: jest.fn() };
    const runtime = create(db);
    expect(query).not.toHaveBeenCalled();
    expect(await runtime.run()).toEqual({ status: 'deferred', reason: 'waiting_for_inventory' });
    // Scoped probes delegate timeout setup to the production read runner;
    // comparison retains its original SET + SELECT callback.
    expect(query).toHaveBeenCalledTimes(scope ? 1 : 2);
    if (scope) expect(db.withTransaction).toHaveBeenCalledWith(expect.any(Function), {
        signal: expect.any(AbortSignal), readOnly: true, timeoutMs: 3000, readinessScope: scope,
    });
    else expect(db.withTransaction.mock.calls[0]).toHaveLength(1);
    expect(db.query).not.toHaveBeenCalled(); expect(db.withSessionAdvisoryLock).not.toHaveBeenCalled();
    runtime.stop(); expect(await runtime.run()).toEqual({ status: 'stopped' });
});

test('a pre-aborted source-pair tick never queries readiness or either admitted permission', async () => {
    const controller = new AbortController(); controller.abort('PRIVATE caller');
    const db = { query: jest.fn(), withTransaction: jest.fn(async () => 'disabled'), withSessionAdvisoryLock: jest.fn() };
    const runtime = createAutomaticSourcePairWorkers(db);
    try {
        expect(await runtime.run({ signal: controller.signal })).toEqual({ status: 'cancelled' });
        expect(db.withTransaction).not.toHaveBeenCalled(); expect(db.query).not.toHaveBeenCalled();
        expect(db.withSessionAdvisoryLock).not.toHaveBeenCalled();
    } finally { runtime.stop(); }
});

test('stopping source-pair preflight aborts its read and fences a late ready result', async () => {
    let release, options;
    const read = new Promise(resolve => { release = resolve; });
    const db = { query: jest.fn(), withTransaction: jest.fn((_callback, readOptions) => { options = readOptions; return read; }), withSessionAdvisoryLock: jest.fn() };
    const runtime = createAutomaticSourcePairWorkers(db), pending = runtime.run();
    runtime.stop(); release('ready');
    expect(await pending).toEqual({ status: 'stopped' });
    expect(options?.signal.aborted).toBe(true);
    expect(db.query).not.toHaveBeenCalled(); expect(db.withSessionAdvisoryLock).not.toHaveBeenCalled();
});
