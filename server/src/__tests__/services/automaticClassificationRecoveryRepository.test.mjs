/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
jest.unstable_mockModule('../../config/database.mjs', () => ({ query: jest.fn() }));
const { AutomaticClassificationRecoveryRepository } = await import('../../services/automaticClassificationRecoveryRepository.mjs');
let database, repository, config, local, leaseValid;
const classification = { id: 1, pending_identity_key: 'tmdb:movie:1' };
beforeEach(() => {
  config = { configuration_revision: '1', primary_provider: 'custom', model: 'model', api_key: 'secret' };
  local = { id: 1, host: 'local', port: 11434, model: 'model' };
  leaseValid = true;
  database = { query: jest.fn(async (sql) => {
    if (sql.includes('SELECT * FROM ai_provider_config')) return { rows: config ? [config] : [] };
    if (sql.includes('SELECT id, host')) return { rows: local ? [local] : [] };
    if (sql.includes('SELECT id FROM classification_recovery_probe_state')) return { rows: leaseValid ? [{ id: true }] : [] };
    return { rows: [] };
  }) };
  repository = new AutomaticClassificationRecoveryRepository({ database, now: () => 100000 });
});
test('bounds candidate selection and excludes routed, legacy and consumed jobs in SQL', async () => {
  await repository.findDue();
  const [sql, args] = database.query.mock.calls[0];
  expect(sql).toContain("status = 'failed'");
  expect(sql).toContain('library_id IS NULL');
  expect(sql).toContain('retry_recovery_attempts = 0');
  expect(args[1]).toBe(900000);
  expect(args[2]).toBe(5);
});
test('persists jittered cooldown before returning a lease, or returns null for competitors', async () => {
  database.query.mockImplementationOnce(async (_sql, [lease]) => ({ rows: [{ lease_token: lease }] }));
  expect(await repository.claimProbe()).toMatch(/^[a-f0-9-]{36}$/);
  expect(database.query.mock.calls[0][0]).toContain("random() * interval '60 seconds'");
  expect(await repository.claimProbe()).toBeNull();
});
test('loads missing configuration fail-closed and never returns secrets in the fingerprint', async () => {
  const first = await repository.loadConfiguration();
  expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  config = null;
  local = null;
  const empty = await repository.loadConfiguration();
  expect(empty.config.primary_provider).toBe('none');
  expect(empty.local).toBeNull();
  expect(empty.fingerprint).not.toBe(first.fingerprint);
});
test.each(['configuration_revision', 'primary_provider', 'model', 'api_key', 'api_endpoint'])('invalidates proof on %s changes', async (field) => {
  const proof = { ...(await repository.loadConfiguration()), checkedAt: 99999 };
  config[field] = 'changed';
  expect(await repository.checkReadiness(database, proof, 'lease', classification)).toMatchObject({ eligible: false, reasonCode: 'recovery_configuration_changed' });
});
test('legacy endpoint changes invalidate readiness even without AI revision changes', async () => {
  const proof = { ...(await repository.loadConfiguration()), checkedAt: 99999 };
  local.host = 'changed';
  expect(await repository.checkReadiness(database, proof, 'lease', classification)).toMatchObject({ eligible: false });
  expect(database.query).toHaveBeenCalledWith('LOCK TABLE ollama_config IN SHARE MODE');
});
test.each([100001, 39999, NaN])('rejects future/stale/invalid readiness time %s', async (checkedAt) => {
  const proof = { ...(await repository.loadConfiguration()), checkedAt };
  expect(await repository.checkReadiness(database, proof, 'lease', classification)).toMatchObject({ eligible: false, reasonCode: 'recovery_readiness_expired' });
});
test.each([true, false])('checks current lease under lock (%s)', async (valid) => {
  leaseValid = valid;
  const proof = { ...(await repository.loadConfiguration()), checkedAt: 40000 };
  expect((await repository.checkReadiness(database, proof, 'lease', classification)).eligible).toBe(valid);
});
test('late completion cannot overwrite a replacement lease', async () => {
  await repository.completeProbe('old-lease', 'unavailable');
  expect(database.query).toHaveBeenCalledWith(expect.stringContaining('lease_token = $1'), ['old-lease', 'unavailable']);
});
test('missing canonical identity is not eligible', async () => {
  expect(await repository.checkReadiness(database, {}, 'lease', {})).toMatchObject({ eligible: false, reasonCode: 'recovery_identity_unavailable' });
  expect(database.query).not.toHaveBeenCalled();
});
test('newer classification supersedes an exhausted row', async () => {
  database.query.mockResolvedValue({ rows: [{ id: 2 }] });
  expect(await repository.checkReadiness(database, {}, 'lease', classification)).toMatchObject({ eligible: false, reasonCode: 'recovery_superseded' });
});
