/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { planEmbeddedIdentity, readEmbeddedAccounts } from '../bootstrap/embeddedIdentityPolicy.mjs';
import { provisionEmbeddedIdentity } from '../bootstrap/embeddedIdentityProvisioning.mjs';

const passwd = 'root:x:0:0:x:x:x\npostgres:x:70:70:x:x:x\nclassifarr:x:1000:1000:x:x:x\n';
const group = 'root:x:0:\npostgres:x:70:\nusers:x:100:\nclassifarr:x:1000:\n';
const accounts = readEmbeddedAccounts(passwd, group);
const plan = (environment = {}, extra = {}) => planEmbeddedIdentity({ environment, uid: 0, gid: 0, accounts, ...extra });

test('default startup is idempotent and Unraid reuses its existing users group', () => {
  expect(plan().commands).toEqual([]);
  expect(plan({ PUID: '99', PGID: '100' }).commands).toEqual([['usermod', ['-u', '99', '-g', '100', 'classifarr']]]);
  expect(plan({ PUID: '2345', PGID: '2345' }).commands).toEqual([
    ['groupmod', ['-g', '2345', 'classifarr']], ['usermod', ['-u', '2345', '-g', '2345', 'classifarr']],
  ]);
});

test.each(['0', '-1', '1.5', '1e3', ' 99', '099', '--root', '2147483648', '4294967295', 'a\n1000'])(
  'rejects invalid ID %j before mutation', value => {
    expect(() => plan({ PUID: value })).toThrow('identity_invalid');
    expect(() => plan({ PGID: value })).toThrow('identity_invalid');
  });
test.each(['999', '18', '00222', 'x', '022\n'])('rejects umask %j', UMASK => expect(() => plan({ UMASK })).toThrow('umask_invalid'));
test.each(['022', '0022', '077'])('accepts umask %s', UMASK => expect(() => plan({ UMASK })).not.toThrow());
test('rejects database account collisions and missing packaged identities', () => {
  expect(() => plan({ PUID: '70' })).toThrow('identity_collision');
  expect(() => plan({ PGID: '70' })).toThrow('identity_collision');
  expect(() => plan({}, { accounts: { users: [], groups: [] } })).toThrow('identity_collision');
});
test('explicit non-root launch retains actual identity without account mutation', () => {
  expect(plan({ PUID: '99', PGID: '100' }, { uid: 1000, gid: 1000 })).toEqual({ mode: 'existing_nonroot', uid: 1000, gid: 1000, commands: [] });
});
test('missing group is created, never deleting a shared group', () => {
  expect(plan({}, { accounts: { ...accounts, groups: [] } }).commands).toEqual([['addgroup', ['-g', '1000', 'classifarr']]]);
});

function fixture() {
  let currentPasswd = passwd;
  const read = jest.fn(async path => path === '/etc/passwd' ? currentPasswd : group);
  const run = jest.fn(async () => { currentPasswd = passwd.replace('1000:1000', '99:100'); });
  return { read, run, environment: { PUID: '99', PGID: '100', SECRET: 'never-inherit' }, uid: 0, gid: 0 };
}
test('applies fixed commands with bounded execution, sanitized environment and readback', async () => {
  const f = fixture();
  expect(await provisionEmbeddedIdentity(f)).toEqual({ mode: 'configured_root', uid: 99, gid: 100 });
  expect(f.run).toHaveBeenCalledWith('/usr/sbin/usermod', ['-u', '99', '-g', '100', 'classifarr'],
    expect.objectContaining({ timeout: 5000, shell: false, env: { PATH: '/usr/sbin:/usr/bin:/sbin:/bin', LC_ALL: 'C' } }));
});
test.each(['rejected', 'not-applied'])('account mutation %s blocks startup', async scenario => {
  const f = fixture();
  if (scenario === 'rejected') f.run.mockRejectedValue(new Error('denied'));
  else f.run.mockResolvedValue({});
  await expect(provisionEmbeddedIdentity(f)).rejects.toThrow(scenario === 'rejected' ? 'denied' : 'not_applied');
});
test('interrupted group update can be completed on retry without deleting any account', () => {
  const partial = readEmbeddedAccounts(passwd, group.replace('classifarr:x:1000', 'classifarr:x:2345'));
  expect(plan({ PUID: '2345', PGID: '2345' }, { accounts: partial }).commands)
    .toEqual([['usermod', ['-u', '2345', '-g', '2345', 'classifarr']]]);
});
test('entrypoint validates before data writes; image code and extensions are not app-owned', () => {
  const shell = readFileSync(new URL('../../../docker-entrypoint.sh', import.meta.url), 'utf8');
  expect(shell.indexOf('provisionEmbeddedIdentity.mjs --apply')).toBeLessThan(shell.indexOf('mkdir -p'));
  expect(shell).not.toContain('Could not modify');
  expect(shell).not.toContain('require(');
  const docker = readFileSync(new URL('../../../Dockerfile', import.meta.url), 'utf8');
  expect(docker).not.toContain('--chown=classifarr:classifarr');
  expect(docker).not.toContain('chown classifarr:classifarr "${PKGLIBDIR}"');
  expect(docker).toContain('chmod -R go-w /app');
});
