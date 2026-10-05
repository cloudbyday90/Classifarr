/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { selectedDeploymentConfiguration as compile } from '../bootstrap/selectedDeploymentConfiguration.mjs';
import { selectedApplicationEnvironment, assertSelectedApplicationBoundary, startSelectedApplication } from '../bootstrap/embeddedSelectedApplication.mjs';
import { selectedMaintenanceEnvironment } from '../bootstrap/embeddedSelectedMaintenanceContract.mjs';
import { validSelectedNodeOptions } from '../bootstrap/selectedNodeOptions.mjs';

const base = { NODE_OPTIONS: '--max-old-space-size=1536' };
const accounts = { users: [{ name: 'classifarr', uid: 1000, gid: 1000 }, { name: 'postgres', uid: 70, gid: 70 }] };
const context = { uid: 1000, gid: 1000, platform: 'linux', cwd: '/app', args: ['--run'] };

test('restore HTTP compilation requires explicit reviewed admission', () => {
  const environment = { ...base, CLASSIFARR_RUNTIME_MODE: 'restore' };
  expect(() => compile(environment)).toThrow('mode_unsupported');
  expect(compile(environment, { allowRestoreHttp: true }).mode).toBe('restore');
  expect(compile(base).mode).toBe('normal');
  expect(() => compile(environment, { allowRestoreHttp: 'true' })).toThrow('invalid');
  expect(() => compile({ ...base, CLASSIFARR_RUNTIME_MODE: 'invalid' }, { allowRestoreHttp: true })).toThrow('mode_unsupported');
});

test('preserves compatible effective defaults, explicit zero/false, credentials and supervisor choices separately', () => {
  const input = Object.freeze({ ...base, PUID: '99', PGID: '100', UMASK: '002', TZ: 'America/New_York',
    PGVECTOR_RUNTIME_STAGING: 'disabled', CLASSIFARR_POSTGRES_STARTUP_TIMEOUT_SECONDS: '600',
    POSTGRES_CONNECT_RETRIES: '0', TASK_QUEUE_RETENTION_DAYS: '0', REFRESH_TOKEN_CLEANUP_ENABLED: 'false',
    API_KEY_ENCRYPTION_KEY: 'ab'.repeat(32), POSTGRES_HOST: 'localhost', POSTGRES_PASSWORD: '' });
  const result = compile(input);
  expect(result.supervisor).toEqual({ uid: 99, gid: 100, umask: '002', vectorStaging: 'disabled', databaseStartupTimeoutMs: 600000 });
  const child = selectedApplicationEnvironment(result.configuration);
  expect(child).toMatchObject({ ...base, POSTGRES_POOL_MAX: '15', POSTGRES_CONNECT_RETRIES: '0',
    TASK_QUEUE_RETENTION_DAYS: '0', REFRESH_TOKEN_CLEANUP_ENABLED: 'false', API_KEY_ENCRYPTION_KEY: input.API_KEY_ENCRYPTION_KEY });
  expect(child.POSTGRES_USER).toBe('cf_runtime');
  for (const name of ['PUID', 'PGID', 'UMASK', 'POSTGRES_PASSWORD', 'PGVECTOR_RUNTIME_STAGING']) expect(child).not.toHaveProperty(name);
  expect(() => assertSelectedApplicationBoundary(child, context, accounts)).not.toThrow();
  expect(selectedMaintenanceEnvironment()).toMatchObject({ NODE_OPTIONS: '--max-old-space-size=512', POSTGRES_POOL_MAX: '1', POSTGRES_CONNECT_RETRIES: '0' });
  expect(selectedMaintenanceEnvironment()).not.toHaveProperty('API_KEY_ENCRYPTION_KEY');
  expect(compile(base).configuration).toMatchObject({ POSTGRES_POOL_MAX: '15', POSTGRES_CONNECT_RETRIES: '2' });
  expect(input.PUID).toBe('99');
});

test('accounts for image/platform metadata without treating it as identity evidence or copying it', () => {
  const configuration = compile({ ...base, HOST_OS: 'Unraid', HOST_HOSTNAME: 'nas', HOST_CONTAINERNAME: 'Classifarr',
    HOSTNAME: 'fixture', NODE_VERSION: '24.21.0', YARN_VERSION: '1.22.22', CLASSIFARR_BUILD_REVISION: 'unknown',
    CLASSIFARR_PGVECTOR_BUILD: 'multi', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', NODE_ENV: 'production' }).configuration;
  expect(configuration).toEqual(compile(base).configuration);
});

test('preserves existing startup deadline precedence instead of reinterpreting PGCTLTIMEOUT', () => {
  expect(compile({ ...base, PGCTLTIMEOUT: '1800' }).supervisor.databaseStartupTimeoutMs).toBe(1800000);
  expect(compile({ ...base, PGCTLTIMEOUT: '600', CLASSIFARR_POSTGRES_STARTUP_TIMEOUT_SECONDS: '30' }).supervisor.databaseStartupTimeoutMs).toBe(30000);
});

test.each(['256', '1024', '1536', '8192', '65536'])('preserves reviewed heap cap %s through the exact child boundary', value => {
  const options = `--max-old-space-size=${value}`;
  expect(validSelectedNodeOptions(options)).toBe(true);
  const child = selectedApplicationEnvironment(compile({ NODE_OPTIONS: options }).configuration);
  expect(child.NODE_OPTIONS).toBe(options);
  expect(() => assertSelectedApplicationBoundary(child, context, accounts)).not.toThrow();
});

test.each(['', '--max-old-space-size=0', '--max-old-space-size=255', '--max-old-space-size=65537',
  '--max-old-space-size=01536', '--max-old-space-size=1536 --require=/tmp/secret', '--import=data:text/javascript,secret',
  '--inspect=0.0.0.0', '--max-old-space-size 1536', '--max_old_space_size=1536', '--max-old-space-size=1e3',
  '--max-old-space-size=1536\n', '--max-old-space-size-percentage=75', '--max-old-space-size=1536;id',
])('rejects unreviewed Node options %# before spawning or reflecting values', value => {
  expect(validSelectedNodeOptions(value)).toBe(false);
  const spawnFn = jest.fn();
  expect(() => startSelectedApplication({ identity: { uid: 1000, gid: 1000 }, uid: 0, platform: 'linux', spawnFn,
    configuration: { NODE_OPTIONS: value } })).toThrow('selected_application_configuration_invalid');
  expect(spawnFn).not.toHaveBeenCalled();
  expect(() => compile({ NODE_OPTIONS: value })).toThrow('selected_deployment_invalid');
});

test.each([
  [{}, 'heap_unresolved'], [{ ...base, DATABASE_URL: 'postgres://secret@remote/db' }, 'setting_unreviewed'],
  [{ ...base, POSTGRES_HOST: 'remote' }, 'authority_unsupported'], [{ ...base, POSTGRES_PASSWORD: 'secret' }, 'authority_unsupported'],
  [{ ...base, CLASSIFARR_RUNTIME_MODE: 'restore' }, 'mode_unsupported'], [{ ...base, CLASSIFARR_RUNTIME_MODE: '' }, 'mode_unsupported'],
  [{ ...base, CLASSIFARR_SCHEMA_MAINTENANCE: 'external' }, 'authority_unsupported'], [{ ...base, NODE_ENV: 'development' }, 'authority_unsupported'],
  [{ ...base, PGVECTOR_RUNTIME_STAGING: 'unknown' }, 'invalid'], [{ ...base, UMASK: '999' }, 'invalid'],
  [{ ...base, PUID: '0' }, 'invalid'], [{ ...base, PUID: '' }, 'invalid'], [{ ...base, PGID: '1;id' }, 'invalid'],
  [{ ...base, PGCTLTIMEOUT: '0' }, 'invalid'], [{ ...base, CLASSIFARR_POSTGRES_STARTUP_TIMEOUT_SECONDS: '1801' }, 'invalid'],
  [{ ...base, POSTGRES_POOL_MAX: '1' }, 'invalid'], [{ ...base, PATH: '/tmp' }, 'authority_unsupported'],
])('rejects unsupported deployment %# with a fixed reason', (environment, reason) => {
  expect(() => compile(environment)).toThrow(new Error(`selected_deployment_${reason}`));
});

test.each(['NODE_PATH', 'LD_PRELOAD', 'NODE_TLS_REJECT_UNAUTHORIZED', 'CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL',
  'POLICY_COMPATIBILITY_NAMED_SCOPE_REPOSITORY_ROOT', 'CLASSIFARR_APPDATA_PATH', 'CLASSIFARR_MEDIA_PATH',
  'CLASSIFARR_MEDIA_READ_ONLY', 'UNKNOWN', 'HOST_NEW_OPTION'])('never silently filters unreviewed %s', key => {
  expect(() => compile({ ...base, [key]: 'secret' })).toThrow(new Error('selected_deployment_setting_unreviewed'));
});

test('rejects accessors without invoking them and bounds the environment snapshot', () => {
  const get = jest.fn();
  const accessor = Object.defineProperty({ ...base }, 'SECRET', { get, enumerable: true });
  const nonenumerable = Object.defineProperty({ ...base }, 'SECRET', { value: 'secret' });
  for (const value of [null, [], Object.create(base), accessor, nonenumerable, { ...base, [Symbol('secret')]: 'secret' },
    { ...base, HOSTNAME: 'a'.repeat(4097) }, { ...base, HOSTNAME: 2 },
    Object.fromEntries(Array.from({ length: 257 }, (_, index) => [`VAR_${index}`, 'value']))]) {
    expect(() => compile(value)).toThrow('selected_deployment_invalid');
  }
  expect(get).not.toHaveBeenCalled();
});

test('current Compose heap and Unraid variable defaults remain accounted for after effective heap resolution', async () => {
  const compose = await readFile(new URL('../../../docker-compose.yml', import.meta.url), 'utf8');
  expect(compose).toContain('NODE_OPTIONS: ${NODE_OPTIONS:---max-old-space-size=1536}');
  const xml = await readFile(new URL('../../../unraid/classifarr.xml', import.meta.url), 'utf8');
  const defaults = Object.fromEntries([...xml.matchAll(/<Config\b[^>]*\bType="Variable"[^>]*\/>/g)].map(([tag]) => [
    tag.match(/\bTarget="([^"]+)"/)[1], tag.match(/\bDefault="([^"]*)"/)[1],
  ]));
  expect(Object.keys(defaults)).toHaveLength(5);
  expect(compile({ ...defaults, ...base }).supervisor).toMatchObject({ uid: 99, gid: 100, umask: '022' });
  expect(() => compile(defaults)).toThrow('heap_unresolved');
});
