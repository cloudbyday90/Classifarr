/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { selectedApplicationConfiguration as configuration } from '../bootstrap/selectedApplicationConfiguration.mjs';
import { selectedApplicationEnvironment, assertSelectedApplicationBoundary } from '../bootstrap/embeddedSelectedApplication.mjs';

test('preserves reviewed application values while fixing executable and database authority', () => {
  const input = { API_KEY_ENCRYPTION_KEY: 'AB'.repeat(32), API_KEY_ENCRYPTION_KEY_FILE: '/run/secrets/key',
    RUNTIME_SETTINGS_FILE: '/config/settings.json', LOG_DIR: '/logs', BACKUP_DIR: '/backups',
    PORT: '22324', TZ: 'America/New_York', FORCE_SECURE_COOKIES: 'true', CSRF_PROTECTION: 'true',
    CORS_ORIGIN: 'https://example.test,http://localhost:21324', LOG_LEVEL: 'warn', LOG_COMPRESS: 'false',
    OMDB_MAX_RETRIES: '3', OMDB_RETRY_TIMEOUT_MULTIPLIER: '2.5' };
  const environment = selectedApplicationEnvironment(input);
  expect(environment).toMatchObject(input);
  expect(environment.POSTGRES_USER).toBe('cf_runtime');
  expect(environment.NODE_OPTIONS).toBe('--max-old-space-size=1024');
  expect(() => assertSelectedApplicationBoundary(environment,
    { uid: 1000, gid: 1000, platform: 'linux', cwd: '/app', args: ['--run'] },
    { users: [{ name: 'classifarr', uid: 1000, gid: 1000 }, { name: 'postgres', uid: 70, gid: 70 }] })).not.toThrow();
});

test.each(['NODE_OPTIONS', 'NODE_PATH', 'LD_PRELOAD', 'DATABASE_URL', 'POSTGRES_USER', 'PATH', 'HOME',
  'CLASSIFARR_RUNTIME_MODE', 'CLASSIFARR_SCHEMA_MAINTENANCE', 'MIGRATIONS_DIR', 'UNKNOWN'])('rejects unreviewed option %s', key => {
  expect(() => configuration({ [key]: 'untrusted' })).toThrow('configuration_invalid');
});
test.each(['relative', '/', '/app/data', '/app/data/postgres/secret', '/app/data/embedded-postgres/key',
  '/app/src/index.mjs', '/proc/self/environ', '/etc/passwd', '/usr/key', '/dev/key', '/root/key',
  '/config/../secret', '/config//key', '/config/key/', '/config/./key', '/config\\key', '/config/\nkey',
  '/' + 'a'.repeat(1025), '/' + Array(33).fill('a').join('/')])('rejects unsafe path %#', value => {
  expect(() => configuration({ API_KEY_ENCRYPTION_KEY_FILE: value })).toThrow('configuration_invalid');
});
test.each([null, [], Object.create({ LOG_LEVEL: 'warn' }), { API_KEY_ENCRYPTION_KEY: '' },
  { API_KEY_ENCRYPTION_KEY: 'not-hex' }, { CSRF_PROTECTION: 'yes' }, { FILE_LOGGING_ENABLED: false },
  { PORT: '0' }, { PORT: '65536' }, { PORT: '5e3' }, { TZ: 'not/a/timezone' }, { LOG_LEVEL: 'unknown' },
  { OMDB_MAX_RETRIES: '-1' }, { OMDB_MAX_RETRIES: '9007199254740992' },
  { OMDB_RETRY_TIMEOUT_MULTIPLIER: '0.5' }, { OMDB_RETRY_TIMEOUT_MULTIPLIER: 'Infinity' },
  { CORS_ORIGIN: '*' }, { CORS_ORIGIN: 'https://user:password@example.test' },
  { CORS_ORIGIN: 'https://example.test/path' }, { CORS_ORIGIN: 'javascript:alert(1)' },
])('rejects malformed profile %# without including values in the error', value => {
  expect(() => configuration(value)).toThrow('selected_application_configuration_invalid');
});
