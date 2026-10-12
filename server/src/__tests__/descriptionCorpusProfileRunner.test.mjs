/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, test, expect } from '@jest/globals';
const install = jest.fn(), remove = jest.fn(), requireDb = jest.fn(), read = jest.fn(), begin = jest.fn();
jest.unstable_mockModule('../scripts/descriptionCorpusProfile/fixture.mjs', () => ({
  installCorpusProfileFixture: install, removeCorpusProfileFixture: remove, requireProfileDatabase: requireDb,
}));
jest.unstable_mockModule('../scripts/descriptionCorpusProfile/measurement.mjs', () => ({
  measureCorpusRead: read, beginCorpusRead: begin, corpusQuerySha256: 'a'.repeat(64),
}));
jest.unstable_mockModule('../scripts/descriptionCorpusProfile/observation.mjs', () => ({
  observeCorpusWork: async (_observer, _pids, work) => ({ result: await work(), waits: { categories: { Lock: 1 } } }),
  memorySnapshot: () => ({ rss: 1 }), summarizeCorpusPlan: jest.fn(),
}));
const { runCorpusProfileMeasurements } = await import('../scripts/descriptionCorpusProfile/runner.mjs');
const db = () => ({ query: jest.fn(async sql => {
  if (sql.includes('SELECT msi.')) throw Object.assign(new Error('private'), { code: '55P03' });
  return { rows: [{ pid: 1 }] };
}) });
beforeEach(() => {
  for (const mock of [install, remove, requireDb, read, begin]) mock.mockReset();
  install.mockResolvedValue({ expectedRows: 100 });
  read.mockResolvedValue({ rows: 100, fingerprint: 'same' });
});

test('bounded matrix alternates concurrency, settles every reader, proves lock recovery and removes both fixtures', async () => {
  const connection = db();
  const withClient = jest.fn(async work => work(db()));
  const report = await runCorpusProfileMeasurements(connection, { withClient, size: 100 });
  expect(withClient).toHaveBeenCalledTimes(2);
  expect(report.scenarios).toHaveLength(2);
  expect(report.scenarios.every(scenario => scenario.cycles.map(cycle => cycle.concurrency).join() === '1,2,2,1,1,2')).toBe(true);
  expect(read).toHaveBeenCalledTimes(26);
  expect(remove).toHaveBeenCalledTimes(2);
  expect(report).toMatchObject({ schemaCleanupVerified: true, providerRequests: 0, productionChanges: 0 });
});
test.each(['warmup', 'read', 'fingerprint', 'cleanup'])('does not swallow %s failure or continue to another fixture', async failure => {
  if (failure === 'warmup') read.mockRejectedValueOnce(new Error('warmup'));
  if (failure === 'read') read.mockResolvedValueOnce({ fingerprint: 'same' }).mockRejectedValueOnce(new Error('private'));
  if (failure === 'fingerprint') read.mockResolvedValueOnce({ fingerprint: 'same' }).mockResolvedValueOnce({ fingerprint: 'different' });
  if (failure === 'cleanup') remove.mockRejectedValueOnce(new Error('cleanup'));
  await expect(runCorpusProfileMeasurements(db(), { withClient: work => work(db()), size: 100 })).rejects.toThrow();
  expect(remove).toHaveBeenCalledTimes(1);
  expect(install).toHaveBeenCalledTimes(1);
});
test('requires connection factory and rejects non-disposable peers before fixture installation', async () => {
  await expect(runCorpusProfileMeasurements(db())).rejects.toThrow('options_invalid');
  requireDb.mockResolvedValueOnce().mockRejectedValueOnce(new Error('wrong_peer'));
  await expect(runCorpusProfileMeasurements(db(), { withClient: work => work(db()) })).rejects.toThrow('wrong_peer');
  expect(install).not.toHaveBeenCalled();
});
