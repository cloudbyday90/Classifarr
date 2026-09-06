/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { installSyncCompatibilityPrototype } from '../inventoryWriterCompatibility/syncSchema.mjs';
import { installCleanupAdmission } from './admissionTriggers.mjs';
import { installCleanupParentGuards } from './parentTriggers.mjs';

/** Empty disposable schema only; caller owns the installation transaction. */
export async function installInventoryCleanupPrototype(db) {
    await installSyncCompatibilityPrototype(db);
    await db.query(`ALTER TABLE scoped_repair_lab.sync_servers ADD COLUMN cleanup_job uuid;
        ALTER TABLE scoped_repair_lab.sync_libraries ADD COLUMN cleanup_job uuid,
            ADD COLUMN media_server_id integer NOT NULL REFERENCES scoped_repair_lab.sync_servers ON DELETE RESTRICT;
        CREATE INDEX ON scoped_repair_lab.sync_libraries(media_server_id,id);
        CREATE INDEX ON scoped_repair_lab.scoped_repair_source(media_server_id,id);
        CREATE TABLE scoped_repair_lab.cleanup_jobs(
            id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('prune','library','server')),
            target_id integer NOT NULL CHECK(target_id>0), server_id integer NOT NULL CHECK(server_id>0),
            state text NOT NULL CHECK(state IN ('collecting','running','completed','cancelled')),
            cursor_id integer NOT NULL DEFAULT 0, high_id integer NOT NULL DEFAULT 0,
            seen_count integer NOT NULL DEFAULT 0, visited bigint NOT NULL DEFAULT 0,
            deleted bigint NOT NULL DEFAULT 0, moved bigint NOT NULL DEFAULT 0,
            absent bigint NOT NULL DEFAULT 0, changed bigint NOT NULL DEFAULT 0,
            parents_deleted bigint NOT NULL DEFAULT 0, started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            sealed_at timestamptz, completed_at timestamptz);
        CREATE UNIQUE INDEX cleanup_one_active_server ON scoped_repair_lab.cleanup_jobs(server_id)
            WHERE state IN ('collecting','running');
        CREATE TABLE scoped_repair_lab.cleanup_seen(job_id uuid NOT NULL REFERENCES scoped_repair_lab.cleanup_jobs,
            external_id varchar(100) NOT NULL, PRIMARY KEY(job_id,external_id));`);
    await installCleanupAdmission(db);
    await installCleanupParentGuards(db);
}
