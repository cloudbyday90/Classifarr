/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { verifySelectedMigration } from '../bootstrap/selectedMigrationVerification.mjs';
import { verifySelectedMigrationPolicy, validateSelectedSystemIdentifier, SELECTED_MIGRATION_HBA, SELECTED_MIGRATION_IDENT } from '../bootstrap/selectedMigrationPolicy.mjs';

const policy = () => ({ hba: SELECTED_MIGRATION_HBA, ident: SELECTED_MIGRATION_IDENT,
  config: "data_directory='/app/data/embedded-postgres/candidate'\nhba_file='/app/data/embedded-postgres/pg_hba.conf'\nident_file='/app/data/embedded-postgres/pg_ident.conf'\nlisten_addresses=''\nunix_socket_directories='/app/data/embedded-postgres/socket'\nshared_preload_libraries='pg_stat_statements'\nshared_buffers='32MB'\nmax_connections=20\n" });
function fixture() {
  const events = [], files = policy();
  const database = { adopt: jest.fn(async () => { events.push('start'); }), stop: jest.fn(async () => { events.push('stop'); }) };
  const options = { expectedSystemId: '123456', platform: 'linux', uid: 0, timeoutMs: 60000,
    prepare: jest.fn(async () => ({ uid: 70, gid: 70 })), read: jest.fn(async kind => files[kind]),
    inspect: jest.fn(async () => ({ entries: [] })), control: jest.fn(async () => { events.push('control'); }),
    createDatabase: jest.fn(() => database), verifyRoles: jest.fn(async () => { events.push('roles'); }) };
  return { options, database, events, files };
}

test('read-only verification checks before launch, joins database, then rechecks', async () => {
  const f = fixture(); await verifySelectedMigration(f.options);
  expect(f.events).toEqual(['control', 'start', 'roles', 'stop', 'control']);
  expect(f.options.inspect).toHaveBeenCalledWith('/app/data/embedded-postgres/candidate', {
    identity: { uid: 70, gid: 70 }, signal: expect.any(AbortSignal) });
  expect(f.options.control).toHaveBeenCalledWith({ expectedSystemId: '123456', signal: expect.any(AbortSignal) });
  expect(f.options.createDatabase).toHaveBeenCalledWith({ timeoutMs: 60000 });
});
test.each(['prepare', 'read', 'inspect', 'control'])('failed %s prevents PostgreSQL startup', async name => {
  const f = fixture(); f.options[name].mockRejectedValue(new Error('refused'));
  await expect(verifySelectedMigration(f.options)).rejects.toThrow('refused');
  expect(f.options.createDatabase).not.toHaveBeenCalled();
});
test('role refusal joins database but cannot return verification success', async () => {
  const f = fixture(); f.options.verifyRoles.mockRejectedValue(new Error('selected_migration_roles_invalid'));
  await expect(verifySelectedMigration(f.options)).rejects.toThrow('roles_invalid');
  expect(f.database.stop).toHaveBeenCalledTimes(1); expect(f.options.control).toHaveBeenCalledTimes(1);
});
test('unjoined helper requires container failure and does not assert database shutdown', async () => {
  const f = fixture(); f.options.verifyRoles.mockRejectedValue(new Error('selected_migration_helper_unjoined'));
  await expect(verifySelectedMigration(f.options)).rejects.toThrow('unjoined');
  expect(f.database.stop).not.toHaveBeenCalled();
});
test('uncertain database stop cannot return success', async () => {
  const f = fixture(); f.database.stop.mockRejectedValue(new Error('unconfirmed'));
  await expect(verifySelectedMigration(f.options)).rejects.toThrow('unconfirmed');
});
test.each(['standby.signal', 'recovery.signal'])('refuses %s before database startup', async relative => {
  const f = fixture(); f.options.inspect.mockResolvedValue({ entries: [{ relative }] });
  await expect(verifySelectedMigration(f.options)).rejects.toThrow('recovery_mode_unsupported');
  expect(f.options.createDatabase).not.toHaveBeenCalled();
});
test('cancellation before admission has no process effects', async () => {
  const f = fixture(); f.options.signal = AbortSignal.abort();
  await expect(verifySelectedMigration(f.options)).rejects.toThrow();
  expect(f.options.prepare).not.toHaveBeenCalled(); expect(f.options.createDatabase).not.toHaveBeenCalled();
});
test.each([{ uid: 1000 }, { platform: 'win32' }, { expectedSystemId: '0' }])('invalid context %j has no effects', async invalid => {
  const f = fixture(); await expect(verifySelectedMigration({ ...f.options, ...invalid })).rejects.toThrow();
  expect(f.options.prepare).not.toHaveBeenCalled();
});
test.each(['', '0', '01', '-1', '18446744073709551616', 123, undefined])('rejects invalid independent identity %p', value => {
  expect(() => validateSelectedSystemIdentifier(value)).toThrow('identity_invalid');
});
test('admits canonical uint64 identity and reviewed memory/connection settings', () => {
  expect(validateSelectedSystemIdentifier('18446744073709551615')).toBe('18446744073709551615');
  expect(() => verifySelectedMigrationPolicy(policy())).not.toThrow();
  const p = policy(); p.config = p.config.replace('32MB', '512MB').replace('max_connections=20', 'max_connections=100');
  expect(() => verifySelectedMigrationPolicy(p)).not.toThrow();
});
test.each(["include='/tmp/other'\n", "archive_command='arbitrary'\n", "shared_buffers='32MB'\n",
  "dynamic_library_path='/tmp'\n", "local_preload_libraries='arbitrary'\n"])('rejects added setting %s', extra => {
  const p = policy(); p.config += extra; expect(() => verifySelectedMigrationPolicy(p)).toThrow('policy_invalid');
});
test.each(['hba', 'ident', 'config'])('rejects mismatched %s without normalizing policy away', key => {
  const p = policy(); p[key] = p[key].replace('classifarr', 'intruder').replace('shared_buffers', 'unknown');
  expect(() => verifySelectedMigrationPolicy(p)).toThrow('policy_invalid');
});
test.each(['0MB', '65537MB', '32GB', '32MB\\ninclude'])('rejects memory value %s', value => {
  const p = policy(); p.config = p.config.replace('32MB', value);
  expect(() => verifySelectedMigrationPolicy(p)).toThrow('policy_invalid');
});
