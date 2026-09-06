/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { installInventoryCleanupPrototype } from '../inventoryCleanup/schema.mjs';
import { installDependentAdmission } from './admission.mjs';
import { installDependentGuards } from './guards.mjs';
import { recordDependentContract } from './contract.mjs';

export async function installDependentCleanupPrototype(db) {
    await installInventoryCleanupPrototype(db);
    await db.query(`ALTER TABLE scoped_repair_lab.sync_libraries ADD COLUMN name text NOT NULL DEFAULT 'Fixture library';
        ALTER TABLE scoped_repair_lab.cleanup_jobs ADD COLUMN dependents_deleted bigint NOT NULL DEFAULT 0,
            ADD COLUMN history_detached bigint NOT NULL DEFAULT 0;
        CREATE TABLE scoped_repair_lab.cleanup_item_claims(item_id integer PRIMARY KEY
            REFERENCES scoped_repair_lab.scoped_repair_source ON DELETE RESTRICT,
            job_id uuid NOT NULL UNIQUE REFERENCES scoped_repair_lab.cleanup_jobs,source_revision text NOT NULL);
        CREATE TABLE scoped_repair_lab.cleanup_retries(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            item_id integer NOT NULL REFERENCES scoped_repair_lab.scoped_repair_source ON DELETE RESTRICT,payload jsonb NOT NULL DEFAULT '{}');
        CREATE INDEX ON scoped_repair_lab.cleanup_retries(item_id,id);
        CREATE TABLE scoped_repair_lab.cleanup_previews(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            item_id integer NOT NULL REFERENCES scoped_repair_lab.scoped_repair_source ON DELETE RESTRICT,payload jsonb NOT NULL DEFAULT '{}');
        CREATE INDEX ON scoped_repair_lab.cleanup_previews(item_id,id);
        CREATE TABLE scoped_repair_lab.cleanup_collections(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            media_server_id integer NOT NULL REFERENCES scoped_repair_lab.sync_servers ON DELETE RESTRICT,
            library_id integer REFERENCES scoped_repair_lab.sync_libraries ON DELETE RESTRICT,payload jsonb NOT NULL DEFAULT '{}');
        CREATE INDEX ON scoped_repair_lab.cleanup_collections(library_id,id);
        CREATE INDEX ON scoped_repair_lab.cleanup_collections(media_server_id,id);
        CREATE TABLE scoped_repair_lab.cleanup_status(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            media_server_id integer NOT NULL REFERENCES scoped_repair_lab.sync_servers ON DELETE RESTRICT,
            library_id integer REFERENCES scoped_repair_lab.sync_libraries ON DELETE RESTRICT,payload jsonb NOT NULL DEFAULT '{}');
        CREATE INDEX ON scoped_repair_lab.cleanup_status(library_id,id);
        CREATE INDEX ON scoped_repair_lab.cleanup_status(media_server_id,id);
        CREATE TABLE scoped_repair_lab.cleanup_history(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            library_id integer REFERENCES scoped_repair_lab.sync_libraries ON DELETE RESTRICT,status text NOT NULL,
            library_name text,error_message text,audit jsonb NOT NULL DEFAULT '{}');
        CREATE INDEX ON scoped_repair_lab.cleanup_history(library_id,id);`);
    await installDependentAdmission(db);
    await installDependentGuards(db);
    await recordDependentContract(db);
}
