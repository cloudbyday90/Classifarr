/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';
import { createIngestionSafeguardRepair } from '../../services/ingestionSafeguardRepair.mjs';
import { readIngestionSafeguardPlan, SAFEGUARD_TABLES, SAFEGUARD_TRIGGERS } from '../../services/ingestionSafeguardCatalog.mjs';
import { RUNTIME_MAINTENANCE_LOCK_KEY } from '../../utils/backupRestoreSessionContract.mjs';
let db, actor, service, backup, definition, clock;
beforeEach(async () => {
  db = { pool: getPool() };
  actor = (await db.pool.query("INSERT INTO users(username,password_hash,role,is_active) VALUES ($1,'synthetic','admin',true) RETURNING id", [randomUUID()])).rows[0].id;
  definition = (await db.pool.query("SELECT pg_get_functiondef('enforce_ingestion_compatibility()'::regprocedure) AS ddl")).rows[0].ddl;
  clock = Date.now();
  backup = { available: async () => true, create: jest.fn(async () => ({ id: randomUUID(), bytes: 10, sha256: 'a'.repeat(64), verification: 'archive_readable' })) };
  service = createIngestionSafeguardRepair(db, { backup, now: () => clock });
});
afterEach(async () => {
  await db.pool.query(definition);
  for (const table of SAFEGUARD_TABLES) for (const trigger of SAFEGUARD_TRIGGERS) await db.pool.query(`ALTER TABLE ${table} ENABLE ALWAYS TRIGGER ${trigger}`);
  await db.pool.query("UPDATE policy_native_intent_reconciliation_restore_gates SET gate_state='ready' WHERE gate_id=1");
  await db.pool.query('DELETE FROM audit_log WHERE user_id=$1', [actor]);
  await db.pool.query('DELETE FROM users WHERE id=$1', [actor]);
});
const disable = () => db.pool.query('ALTER TABLE media_server_items DISABLE TRIGGER ingestion_compatibility_rows');
const apply = async () => { const plan = await service.preview(actor); return service.apply(actor, { token: plan.token, confirm: true }); };

test('healthy and fresh catalog is a no-op without backup or token', async () => {
  expect(await service.preview(actor)).toMatchObject({ reason: 'not_needed', token: null, changes: [] });
  expect(backup.create).not.toHaveBeenCalled();
});
test('repairs only reviewed disabled triggers and atomically audits without changing inventory', async () => {
  await disable();
  const before = (await db.pool.query('SELECT count(*) FROM media_server_items')).rows;
  const plan = await service.preview(actor);
  expect(plan).toMatchObject({ reason: 'confirmation_required', changes: [{ table: 'media_server_items', trigger: 'ingestion_compatibility_rows' }] });
  const result = await service.apply(actor, { token: plan.token, confirm: true });
  expect(result).toMatchObject({ status: 'repaired', changed: 1 });
  expect((await readIngestionSafeguardPlan(db.pool)).reason).toBe('not_needed');
  expect((await db.pool.query('SELECT count(*) FROM media_server_items')).rows).toEqual(before);
  expect((await db.pool.query("SELECT metadata FROM audit_log WHERE id=$1", [result.auditId])).rows[0].metadata.backup).toEqual(result.backup);
  await expect(service.apply(actor, { token: plan.token, confirm: true })).rejects.toMatchObject({ code: 'repair_review_expired' });
});
test('backup failure leaves safeguards disabled', async () => {
  await disable(); backup.create.mockRejectedValue(new Error('secret database details'));
  await expect(apply()).rejects.toMatchObject({ code: 'repair_backup_failed' });
  expect((await service.preview(actor)).reason).toBe('confirmation_required');
});
test('a changed catalog after backup refuses DDL and retains the backup', async () => {
  await disable();
  backup.create.mockImplementation(async () => {
    await db.pool.query('ALTER TABLE media_server_collections DISABLE TRIGGER ingestion_compatibility_rows');
    return { id: randomUUID() };
  });
  await expect(apply()).rejects.toMatchObject({ code: 'repair_state_changed' });
  expect((await service.preview(actor)).changes).toHaveLength(2);
});
test('changed function body is refused even though function identity is unchanged', async () => {
  await disable();
  await db.pool.query(definition.replace('RETURN NEW;', 'RETURN OLD;'));
  expect(await service.preview(actor)).toMatchObject({ reason: 'definition_changed', token: null });
});
test('changed trigger condition is refused', async () => {
  await db.pool.query('DROP TRIGGER ingestion_compatibility_rows ON media_server_items');
  await db.pool.query('CREATE TRIGGER ingestion_compatibility_rows BEFORE INSERT OR UPDATE OR DELETE ON media_server_items FOR EACH ROW WHEN (true) EXECUTE FUNCTION enforce_ingestion_compatibility()');
  try { expect(await service.preview(actor)).toMatchObject({ reason: 'definition_changed', token: null }); }
  finally {
    await db.pool.query('DROP TRIGGER ingestion_compatibility_rows ON media_server_items');
    await db.pool.query('CREATE TRIGGER ingestion_compatibility_rows BEFORE INSERT OR UPDATE OR DELETE ON media_server_items FOR EACH ROW EXECUTE FUNCTION enforce_ingestion_compatibility()');
  }
});
test('restore quarantine, missing tools and expired plans refuse', async () => {
  await disable();
  const plan = await service.preview(actor); clock += 300001;
  await expect(service.apply(actor, { token: plan.token, confirm: true })).rejects.toMatchObject({ code: 'repair_review_expired' });
  backup.available = async () => false;
  expect((await service.preview(actor)).reason).toBe('backup_tools_unavailable');
  await db.pool.query("UPDATE policy_native_intent_reconciliation_restore_gates SET gate_state='requires_maintenance' WHERE gate_id=1");
  expect((await service.preview(actor)).reason).toBe('restore_required');
});
test('schema/restore maintenance lock rejects before backup; shared normal admission permits repair', async () => {
  await disable(); const owner = await db.pool.connect();
  try {
    await owner.query('SELECT pg_advisory_lock($1)', [RUNTIME_MAINTENANCE_LOCK_KEY]);
    await expect(apply()).rejects.toMatchObject({ code: 'repair_busy' });
    expect(backup.create).not.toHaveBeenCalled();
    await owner.query('SELECT pg_advisory_unlock($1)', [RUNTIME_MAINTENANCE_LOCK_KEY]);
    await owner.query('SELECT pg_advisory_lock_shared($1)', [RUNTIME_MAINTENANCE_LOCK_KEY]);
    expect(await apply()).toMatchObject({ status: 'repaired' });
  } finally { owner.release(true); }
});
test('active administrator is rechecked after preview', async () => {
  await disable(); const plan = await service.preview(actor);
  await db.pool.query('UPDATE users SET is_active=false WHERE id=$1', [actor]);
  await expect(service.apply(actor, { token: plan.token, confirm: true })).rejects.toMatchObject({ statusCode: 403 });
  expect(backup.create).not.toHaveBeenCalled();
});
test('cross-actor and malformed confirmations cannot authorize changes', async () => {
  await disable(); const plan = await service.preview(actor);
  await expect(service.apply(actor + 100, { token: plan.token, confirm: true })).rejects.toMatchObject({ code: 'repair_review_expired' });
  for (const body of [null, { token: plan.token, confirm: false }, { token: plan.token, confirm: true, table: 'users' }]) {
    await expect(service.apply(actor, body)).rejects.toMatchObject({ statusCode: 400 });
  }
  expect(backup.create).not.toHaveBeenCalled();
});
test('a blocked writer drains before repair; late legacy writes are rejected after commit', async () => {
  await disable(); const writer = await db.pool.connect();
  let started;
  const backupStarted = new Promise(resolve => { started = resolve; });
  backup.create.mockImplementation(async () => { started(); return { id: randomUUID() }; });
  try {
    await writer.query('BEGIN'); await writer.query('LOCK TABLE media_server_items IN ROW EXCLUSIVE MODE');
    const repairing = apply(); await backupStarted;
    expect((await service.preview(actor)).reason).toBe('busy');
    let waiting = false;
    for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
      waiting = (await db.pool.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE relation='media_server_items'::regclass AND mode='ShareRowExclusiveLock' AND NOT granted) AS waiting")).rows[0].waiting;
      if (!waiting) await new Promise(resolve => { setTimeout(resolve, 10); });
    }
    expect(waiting).toBe(true);
    await writer.query('COMMIT');
    await expect(repairing).resolves.toMatchObject({ status: 'repaired' });
    await writer.query("SET classifarr.ingestion_protocol='0'");
    await expect(writer.query('TRUNCATE media_server_items CASCADE')).rejects.toMatchObject({ code: '55000' });
  } finally { writer.release(true); }
});
test('repair plans are bounded and restart invalidates a token', async () => {
  await disable(); const plan = await service.preview(actor);
  const otherService = createIngestionSafeguardRepair(db, { backup });
  await expect(otherService.apply(actor, { token: plan.token, confirm: true })).rejects.toMatchObject({ code: 'repair_review_expired' });
  for (let i = 0; i < 31; i++) await service.preview(actor);
  expect((await service.preview(actor)).reason).toBe('busy');
});

test('audit failure rolls back trigger changes instead of reporting unaudited success', async () => {
  await disable();
  const faulty = { pool: { options: db.pool.options, connect: async () => {
    const client = await db.pool.connect(), query = client.query.bind(client);
    client.query = (...args) => {
      if (String(args[0]).includes("VALUES ($1,'ingestion_safeguards_repaired'")) throw new Error('synthetic audit failure');
      return query(...args);
    };
    return client;
  } } };
  const failing = createIngestionSafeguardRepair(faulty, { backup });
  const plan = await failing.preview(actor);
  await expect(failing.apply(actor, { token: plan.token, confirm: true })).rejects.toMatchObject({ code: 'repair_unavailable' });
  expect((await service.preview(actor)).reason).toBe('confirmation_required');
  expect((await db.pool.query("SELECT count(*)::int AS count FROM audit_log WHERE user_id=$1 AND action='ingestion_safeguards_repaired'", [actor])).rows[0].count).toBe(0);
});
test('a lost commit response is unknown and never replays the consumed plan', async () => {
  await disable();
  const uncertain = { pool: { options: db.pool.options, connect: async () => {
    const client = await db.pool.connect(), query = client.query.bind(client);
    client.query = async (...args) => {
      const result = await query(...args);
      if (args[0] === 'COMMIT') throw new Error('synthetic lost commit response');
      return result;
    };
    return client;
  } } };
  const repairing = createIngestionSafeguardRepair(uncertain, { backup });
  const plan = await repairing.preview(actor);
  const body = { token: plan.token, confirm: true };
  await expect(repairing.apply(actor, body)).rejects.toMatchObject({ code: 'repair_outcome_unknown' });
  await expect(repairing.apply(actor, body)).rejects.toMatchObject({ code: 'repair_review_expired' });
  expect((await service.preview(actor)).reason).toBe('not_needed');
  expect(backup.create).toHaveBeenCalledTimes(1);
  expect((await db.pool.query("SELECT count(*)::int AS count FROM audit_log WHERE user_id=$1 AND action='ingestion_safeguards_repaired'", [actor])).rows[0].count).toBe(1);
});
test('changed marker column contract is refused', async () => {
  await disable();
  await db.pool.query('ALTER TABLE media_server_sync_status ALTER COLUMN ingestion_protocol DROP NOT NULL');
  try { expect((await service.preview(actor)).reason).toBe('definition_changed'); }
  finally { await db.pool.query('ALTER TABLE media_server_sync_status ALTER COLUMN ingestion_protocol SET NOT NULL'); }
});
test('another process cannot overlap a repair during backup', async () => {
  await disable();
  let start, finish;
  const started = new Promise(resolve => { start = resolve; });
  const pending = new Promise(resolve => { finish = resolve; });
  backup.create.mockImplementation(async () => { start(); await pending; return { id: randomUUID() }; });
  const other = createIngestionSafeguardRepair(db, { backup });
  const otherPlan = await other.preview(actor);
  const running = apply(); await started;
  try {
    await expect(other.apply(actor, { token: otherPlan.token, confirm: true })).rejects.toMatchObject({ code: 'repair_busy' });
  } finally { finish(); await running; }
});
test('read-only runtime identity does not gain repair authority', async () => {
  await disable(); const role = `repair_read_${randomUUID().replaceAll('-', '')}`;
  await db.pool.query(`CREATE ROLE ${role}`);
  await db.pool.query(`GRANT SELECT ON users,schema_migrations,policy_native_intent_reconciliation_restore_gates TO ${role}`);
  const client = await db.pool.connect();
  try {
    await client.query(`SET ROLE ${role}`);
    expect((await readIngestionSafeguardPlan(client)).reason).toBe('maintenance_identity_required');
  } finally {
    await client.query('RESET ROLE'); client.release(true);
    await db.pool.query(`DROP OWNED BY ${role}`); await db.pool.query(`DROP ROLE ${role}`);
  }
});
