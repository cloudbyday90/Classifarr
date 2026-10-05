/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { prepareOfflineMigrationCopy } from '../bootstrap/offlineMigrationCopy.mjs';
import { migrationSourceBinding, validateOfflineMigrationPaths } from '../bootstrap/offlineMigrationSourceRecord.mjs';

const record = () => ({ version: 1, source: '/app/data/postgres', candidate: '/app/data/embedded-postgres/candidate',
  systemId: '123456', digest: 'a'.repeat(64), bytes: 1000, entries: 2,
  applicationUid: 1000, applicationGid: 1000, databaseUid: 70, databaseGid: 70 });
function fixture() {
  const state = { source: null, receipt: null, selection: null };
  const value = record(), tree = { entries: [{ relative: '', directory: true }], bytes: 1000 };
  const options = { platform: 'linux', uid: 0,
    journal: { read: jest.fn(async () => state.receipt), selection: { read: jest.fn(async () => state.selection) },
      source: { read: jest.fn(async () => state.source), write: jest.fn(async row => { state.source = { ...row }; }) } },
    read: jest.fn(async () => ({ record: { ...value }, tree })), present: jest.fn(async () => false),
    inspect: jest.fn(async () => tree), digest: jest.fn(async () => value.digest), copy: jest.fn(async () => {}),
    remove: jest.fn(async () => {}), protect: jest.fn(async () => {}), sync: jest.fn(async () => {}),
    space: jest.fn(async () => ({ bavail: 2000, bsize: 1 })) };
  const admit = () => { state.receipt = { version: 1, binding: migrationSourceBinding(value), completed: 0, pending: 'copy' }; };
  return { options, state, value, tree, admit };
}

test('source is durable before copy; admitted copy syncs then verifies destination and original', async () => {
  const f = fixture(), prepared = await prepareOfflineMigrationCopy(f.options);
  expect(f.state.source).toEqual(f.value); expect(f.options.copy).not.toHaveBeenCalled();
  f.admit(); await prepared.copy();
  expect(f.options.copy).toHaveBeenCalledWith(f.value.source, f.value.candidate, f.tree, { signal: expect.any(AbortSignal) });
  expect(f.options.journal.source.write.mock.invocationCallOrder[0]).toBeLessThan(f.options.copy.mock.invocationCallOrder[0]);
  expect(f.options.copy.mock.invocationCallOrder[0]).toBeLessThan(f.options.sync.mock.invocationCallOrder[0]);
  expect(f.options.sync.mock.invocationCallOrder[0]).toBeLessThan(f.options.digest.mock.invocationCallOrder[0]);
  expect(f.options.read).toHaveBeenCalledTimes(3); expect(f.options.remove).not.toHaveBeenCalled();
});
test('a registered partial copy alone can be replaced after space and tree checks', async () => {
  const f = fixture(); f.state.source = f.value; f.admit(); f.options.present.mockResolvedValue(true);
  const prepared = await prepareOfflineMigrationCopy(f.options); await prepared.copy();
  expect(f.options.remove).toHaveBeenCalledWith(f.value.candidate, { recursive: true });
  expect(f.options.space.mock.invocationCallOrder[0]).toBeLessThan(f.options.remove.mock.invocationCallOrder[0]);
  expect(f.options.inspect.mock.invocationCallOrder[0]).toBeLessThan(f.options.remove.mock.invocationCallOrder[0]);
});
test.each(['receipt', 'selection', 'candidate'])('lost source record with %s cannot be regenerated', async kind => {
  const f = fixture();
  if (kind === 'candidate') f.options.present.mockResolvedValue(true); else f.state[kind] = {};
  await expect(prepareOfflineMigrationCopy(f.options)).rejects.toThrow('provenance_missing');
  expect(f.options.read).not.toHaveBeenCalled(); expect(f.options.journal.source.write).not.toHaveBeenCalled();
});
test.each(['digest', 'systemId', 'databaseUid'])('changed original %s refuses before record rewrite', async field => {
  const f = fixture(); f.state.source = { ...f.value, [field]: field === 'digest' ? 'b'.repeat(64) : field === 'systemId' ? '123457' : 71 };
  await expect(prepareOfflineMigrationCopy(f.options)).rejects.toThrow('source_changed');
  expect(f.options.journal.source.write).not.toHaveBeenCalled();
});
test.each(['not-pending', 'later-phase', 'selected', 'source-changed', 'record-changed', 'no-space', 'pid', 'link', 'cancel'])('copy refusal %s has no deletion or copy', async failure => {
  const f = fixture(), controller = new AbortController(); f.options.signal = controller.signal;
  const prepared = await prepareOfflineMigrationCopy(f.options); f.admit(); f.options.present.mockResolvedValue(true);
  if (failure === 'not-pending') f.state.receipt.pending = null;
  if (failure === 'later-phase') Object.assign(f.state.receipt, { completed: 1, pending: 'ownership' });
  if (failure === 'selected') f.state.selection = { phase: 'selected' };
  if (failure === 'source-changed') f.value.digest = 'b'.repeat(64);
  if (failure === 'record-changed') f.state.source.digest = 'b'.repeat(64);
  if (failure === 'no-space') f.options.space.mockResolvedValue({ bavail: 1099, bsize: 1 });
  if (failure === 'pid') f.options.inspect.mockResolvedValue({ entries: [{ relative: 'postmaster.pid' }] });
  if (failure === 'link') f.options.inspect.mockRejectedValue(new Error('migration_tree_unsupported'));
  if (failure === 'cancel') controller.abort();
  await expect(prepared.copy()).rejects.toThrow();
  expect(f.options.remove).not.toHaveBeenCalled(); expect(f.options.copy).not.toHaveBeenCalled();
});
test.each(['source-fsync', 'copy-io', 'parent-fsync', 'digest', 'source-after'])('failure %s never reports completion', async failure => {
  const f = fixture();
  if (failure === 'source-fsync') {
    f.options.journal.source.write.mockRejectedValue(new Error('disk_failed'));
    await expect(prepareOfflineMigrationCopy(f.options)).rejects.toThrow('disk_failed');
  } else {
    const prepared = await prepareOfflineMigrationCopy(f.options); f.admit();
    if (failure === 'copy-io') f.options.copy.mockRejectedValue(new Error('disk_failed'));
    if (failure === 'parent-fsync') f.options.sync.mockRejectedValue(new Error('disk_failed'));
    if (failure === 'digest') f.options.digest.mockResolvedValue('b'.repeat(64));
    if (failure === 'source-after') f.options.copy.mockImplementation(async () => { f.value.systemId = '123457'; });
    await expect(prepared.copy()).rejects.toThrow();
    expect(f.state.receipt.pending).toBe('copy');
  }
});
test('resume resyncs the same source record without accepting a different binding', async () => {
  const f = fixture(); f.state.source = f.value;
  const prepared = await prepareOfflineMigrationCopy(f.options);
  expect(prepared.binding).toBe(migrationSourceBinding(f.value)); expect(f.options.journal.source.write).toHaveBeenCalledTimes(1);
});
test.each([{ platform: 'win32' }, { uid: 1000 }, { source: '/' }, { candidate: '/app/data' }])('invalid context %j has no record effects', async override => {
  const f = fixture(); await expect(prepareOfflineMigrationCopy({ ...f.options, ...override })).rejects.toThrow();
  expect(f.options.journal.source.read).not.toHaveBeenCalled();
});
test.each([{ extra: true }, { version: 2 }, { systemId: '01' }, { bytes: -1 }, { entries: 50001 },
  { databaseUid: 1000 }, { applicationGid: '1000' }, { digest: 'invalid' }])('invalid source record %j is rejected', change => {
  expect(() => migrationSourceBinding({ ...record(), ...change })).toThrow();
});
test('binding is independent of JSON property order and overlapping layouts are refused', () => {
  const value = record(); expect(migrationSourceBinding(Object.fromEntries(Object.entries(value).reverse()))).toBe(migrationSourceBinding(value));
  expect(() => validateOfflineMigrationPaths('/app/data/postgres', '/app/data/postgres/candidate')).toThrow();
});
