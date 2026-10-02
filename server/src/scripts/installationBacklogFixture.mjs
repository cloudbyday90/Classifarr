/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertInstallationBudgetEnvironment } from './installationConnectionPressure.mjs';

export const BACKLOG_GATE_LOCK = 19760211;

/** Fault injection and audit objects exist only in the disposable fixture database. */
export async function installBacklogGate(db, libraries) {
  assertInstallationBudgetEnvironment();
  assert.deepEqual(libraries.map(row => row.media_type).sort(), ['movie', 'tv']);
  assert.ok(libraries.every(row => Number.isSafeInteger(row.id) && row.id > 0));
  await db.withTransaction(async client => {
    await client.query(`CREATE TABLE installation_backlog_targets (library_id integer PRIMARY KEY, media_type text NOT NULL);
      CREATE TABLE installation_backlog_dispatch (
        task_id integer PRIMARY KEY, starts integer NOT NULL DEFAULT 0, completions integer NOT NULL DEFAULT 0,
        last_started_at timestamp, first_completed_at timestamp);
      CREATE FUNCTION installation_backlog_gate() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.enrichment_status = 'processing' AND EXISTS (
          SELECT 1 FROM installation_backlog_targets WHERE library_id=NEW.library_id) THEN
          PERFORM pg_advisory_xact_lock(${BACKLOG_GATE_LOCK});
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER installation_backlog_gate BEFORE UPDATE OF enrichment_status ON media_server_items
        FOR EACH ROW EXECUTE FUNCTION installation_backlog_gate();
      CREATE FUNCTION installation_backlog_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM installation_backlog_targets
          WHERE library_id::text=NEW.payload->>'source_library_id') THEN
          IF TG_OP='INSERT' THEN
            INSERT INTO installation_backlog_dispatch(task_id) VALUES (NEW.id);
          ELSE
            UPDATE installation_backlog_dispatch SET
              starts=starts+CASE WHEN NEW.status='processing' AND
                (OLD.status IS DISTINCT FROM NEW.status OR OLD.started_at IS DISTINCT FROM NEW.started_at) THEN 1 ELSE 0 END,
              completions=completions+CASE WHEN NEW.status='completed' AND
                (OLD.status IS DISTINCT FROM NEW.status OR OLD.completed_at IS DISTINCT FROM NEW.completed_at) THEN 1 ELSE 0 END,
              last_started_at=CASE WHEN NEW.status='processing' THEN NEW.started_at ELSE last_started_at END,
              first_completed_at=CASE WHEN NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status
                THEN COALESCE(first_completed_at,NEW.completed_at) ELSE first_completed_at END
            WHERE task_id=NEW.id;
          END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER installation_backlog_audit AFTER INSERT OR UPDATE ON task_queue
        FOR EACH ROW EXECUTE FUNCTION installation_backlog_audit()`);
    for (const row of libraries) await client.query(
      'INSERT INTO installation_backlog_targets(library_id,media_type) VALUES ($1,$2)', [row.id, row.media_type]);
  });
}
