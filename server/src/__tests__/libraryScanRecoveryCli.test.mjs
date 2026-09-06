/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { runLibraryScanRecoveryBenchmark } from '../scripts/runLibraryScanRecoveryBenchmark.mjs';

function runtime() {
    const container = { getHost: () => '127.0.0.1', getPort: () => 54321, getDatabase: () => 'disposable',
        getUsername: () => 'benchmark', getPassword: () => 'PRIVATE', stop: jest.fn() };
    const client = { connect: jest.fn(), end: jest.fn(), query: jest.fn().mockResolvedValue({ rows: [{ server_version: '18.6' }] }) };
    return { container, client, start: jest.fn().mockResolvedValue(container), connect: jest.fn().mockReturnValue(client),
        measure: jest.fn().mockResolvedValue({ version: 'report', candidates: [] }), argv: [] };
}
test('uses only the disposable container credentials and closes connections before removing it', async () => {
    const deps = runtime();
    expect(await runLibraryScanRecoveryBenchmark(deps)).toEqual({ version: 'report', candidates: [], postgresVersion: '18.6', postgresImage: 'postgres:18.6-alpine' });
    expect(deps.start.mock.calls[0][0]).toMatch(/^[a-f0-9]{48}$/);
    expect(deps.connect).toHaveBeenCalledWith(expect.objectContaining({ database: 'disposable', port: 54321, statement_timeout: 15000 }));
    expect(deps.client.end).toHaveBeenCalledTimes(1);
    expect(deps.container.stop).toHaveBeenCalledTimes(1);
    expect(deps.client.end.mock.invocationCallOrder[0]).toBeLessThan(deps.container.stop.mock.invocationCallOrder[0]);
});
test.each([['--database-url=PRIVATE'], ['--image=PRIVATE'], null])('rejects all caller arguments before starting Docker: %j', async argv => {
    const deps = runtime();
    await expect(runLibraryScanRecoveryBenchmark({ ...deps, argv })).rejects.toThrow('no arguments');
    expect(deps.start).not.toHaveBeenCalled();
});
test.each(['connect', 'measure', 'end'])('cleans up the container after %s failure', async stage => {
    const deps = runtime();
    (stage === 'measure' ? deps.measure : deps.client[stage]).mockRejectedValue(new Error('PRIVATE'));
    await expect(runLibraryScanRecoveryBenchmark(deps)).rejects.toThrow('PRIVATE');
    expect(deps.container.stop).toHaveBeenCalledTimes(1);
});
test('also removes the container if client construction fails', async () => {
    const deps = runtime(); deps.connect.mockImplementation(() => { throw new Error('constructor failed'); });
    await expect(runLibraryScanRecoveryBenchmark(deps)).rejects.toThrow('constructor failed');
    expect(deps.container.stop).toHaveBeenCalledTimes(1);
});

test.each([false, true])('scoped peer connections close before container cleanup, callback failure: %s', async fail => {
    const deps = runtime();
    const peer = { connect: jest.fn(), end: jest.fn() };
    deps.connect.mockReturnValueOnce(deps.client).mockReturnValueOnce(peer);
    deps.measure.mockImplementation(async (_db, { withClient }) => withClient(async client => {
        expect(client).toBe(peer);
        if (fail) throw new Error('peer failed');
        return { peerUsed: true };
    }));
    if (fail) await expect(runLibraryScanRecoveryBenchmark(deps)).rejects.toThrow('peer failed');
    else expect(await runLibraryScanRecoveryBenchmark(deps)).toMatchObject({ peerUsed: true });
    expect(peer.end).toHaveBeenCalledTimes(1);
    expect(peer.end.mock.invocationCallOrder[0]).toBeLessThan(deps.container.stop.mock.invocationCallOrder[0]);
});
