/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayArchiveConfiguration, validateArchiveManifest, validateArchiveReport, ARCHIVE_LIMIT } from '../ollamaGateway/archiveContract.mjs';
import { archiveDumpOptions } from '../ollamaGateway/archiveDump.mjs';

const id = '0199ea26-7d80-7000-8000-000000000001';
const config = () => ({ database: { host: '/var/run/postgresql', database: 'gateway', user: 'reader' }, providerHash: 'a'.repeat(64), retentionDays: 90 });
const report = () => ({ ledgerId: id, providerHash: 'a'.repeat(64), capturedAt: '2026-10-15T00:00:00.000Z', cutoff: '2026-07-17T00:00:00.000Z',
  retentionDays: 90, attempts: '0', bindingCount: 0, counts: { admission: 1, request_binding: 0, completion_receipt: 0, recovery_receipt: 0,
    provider_stop_intent: 0, provider_stop_observation: 0, upstream_peer_observation: 0 },
  categories: { active: 0, lifecycle: 0, unknown: 0, recent: 0, older_terminal_review: 0 }, counterMatches: true,
  legacyActiveWithoutBinding: false, purgeAuthorized: false });
const manifest = () => ({ version: 1, schemaVersion: 7, archiveId: id, report: report(), dump: { name: 'gateway.dump', bytes: 50, sha256: 'b'.repeat(64) } });

test('explicit configuration and manifest round trip without changing the caller', () => {
  const input = config(); expect(gatewayArchiveConfiguration(input)).toEqual(input);
  expect(gatewayArchiveConfiguration(input).database).not.toBe(input.database);
  expect(validateArchiveManifest(manifest())).toEqual(manifest());
});
test.each([0, -1, 3651, '90', 1.5, null])('retention requires an explicit bounded integer: %s', retentionDays => {
  expect(() => gatewayArchiveConfiguration({ ...config(), retentionDays })).toThrow('gateway_archive_config_invalid');
});
test.each([{ host: 'localhost' }, { host: '/tmp/../run' }, { host: '/tmp\0socket' }, { user: 'user password=private' },
  { database: 'postgres://private' }, { port: 0 }, { port: '5432' }, { ssl: true }, { password: 'x\0' }])('reject unsafe connection shape %j', extra => {
  const input = config(); input.database = { ...input.database, ...extra };
  expect(() => gatewayArchiveConfiguration(input)).toThrow();
});
test.each([{ version: 2 }, { schemaVersion: 8 }, { archiveId: '00000000-0000-4000-8000-000000000000' },
  { unknown: true }, { dump: { name: '../gateway.dump', bytes: 5, sha256: 'b'.repeat(64) } },
  { dump: { name: 'gateway.dump', bytes: ARCHIVE_LIMIT + 1, sha256: 'b'.repeat(64) } }])('reject incompatible or unsafe manifest %j', value => {
  expect(() => validateArchiveManifest({ ...manifest(), ...value })).toThrow();
});
test.each([{ purgeAuthorized: true }, { counterMatches: false }, { bindingCount: -1 }, { attempts: '9223372036854775808' },
  { categories: { ...report().categories, older_terminal_review: 1 } }, { capturedAt: 'not a date' }, { cutoff: report().capturedAt }])('reject misleading report %j', value => {
  expect(() => validateArchiveReport({ ...report(), ...value })).toThrow();
});
test('dump uses a fixed schema and snapshot, excludes ambient configuration and keeps credentials out of args', () => {
  const value = config(); value.database.password = 'synthetic-private';
  const options = archiveDumpOptions(value, '00000001-000000AB-1');
  expect(options.args).toContain('--snapshot=00000001-000000AB-1'); expect(options.args).toContain('--schema=ollama_gateway');
  expect(options.args.join(' ')).not.toContain(value.database.password);
  expect(options.env.PGPASSWORD).toBe(value.database.password); expect(options.env.PGPASSFILE).toBe('/dev/null');
  expect(options.env.PGOPTIONS).toContain('default_transaction_read_only=on'); expect(options.env).not.toHaveProperty('PGSERVICE');
  expect(() => archiveDumpOptions(value, 'x; DROP TABLE')).toThrow();
});
