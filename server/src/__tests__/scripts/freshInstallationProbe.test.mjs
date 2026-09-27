/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { verifyFreshInstallation } from '../../scripts/freshInstallationProbe.mjs';

const environment = { CLASSIFARR_UPGRADE_DRILL: 'isolated-compose-v1', POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432', POSTGRES_DB: 'classifarr', POSTGRES_USER: 'classifarr',
  BACKUP_DIR: '/app/data/backups', MIGRATIONS_DIR: '/app/database/migrations' };
let original;
beforeEach(() => { original = { ...process.env }; Object.assign(process.env, environment); });
afterEach(() => { process.env = original; });

const fixture = () => {
  const rows = [ [{ filename: '001_initial.sql' }], [{ gate_id: 1, gate_state: 'ready', reason_id: 'startup_ready',
    restore_token: null, verified_at: null }], [{ sampling: 1, provider: 1, patterns: 1, embedding: 1, csrf: 1,
    retention: 1, users: 0, libraries: 0, receipts: 0 }], [{ version: '180006', migrations: 1 }] ];
  return { rows, db: { query: jest.fn(async () => ({ rows: rows.shift() })) },
    options: { request: async () => ({ status: 200, body: { status: 'healthy' } }),
      readMigrations: async () => ['README.md', '001_initial.sql'] } };
};
test('checks real startup, exact ledger and selected operational seeds without writes', async () => {
  const { db, options } = fixture();
  expect(await verifyFreshInstallation(db, options)).toEqual({ status: 'passed', database: { version: '180006', migrations: 1 } });
  expect(db.query.mock.calls.every(([sql]) => sql.trim().startsWith('SELECT'))).toBe(true);
});
test.each(['sampling', 'provider', 'patterns', 'embedding', 'csrf', 'retention'])('missing %s seed blocks fresh acceptance', async field => {
  const { rows, db, options } = fixture(); rows[2][0][field] = 0;
  await expect(verifyFreshInstallation(db, options)).rejects.toThrow();
});
test.each(['users', 'libraries', 'receipts'])('existing %s means the volume is not fresh', async field => {
  const { rows, db, options } = fixture(); rows[2][0][field] = 1;
  await expect(verifyFreshInstallation(db, options)).rejects.toThrow();
});
test('missing gate or migration ledger entry fails', async () => {
  for (const index of [0, 1]) {
    const { rows, db, options } = fixture(); rows[index] = [];
    await expect(verifyFreshInstallation(db, options)).rejects.toThrow();
  }
});
test('unhealthy startup and unsafe environment fail before probing the database', async () => {
  const { db, options } = fixture();
  await expect(verifyFreshInstallation(db, { ...options, request: async () => ({ body: { status: 'unhealthy' } }) })).rejects.toThrow();
  process.env.CLASSIFARR_UPGRADE_DRILL = 'live';
  await expect(verifyFreshInstallation(db, options)).rejects.toThrow();
  expect(db.query).not.toHaveBeenCalled();
});
