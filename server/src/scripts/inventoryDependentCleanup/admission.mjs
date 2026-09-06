/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CLEANUP_LOCK_NAMESPACE } from '../inventoryCleanup/contract.mjs';

export async function installDependentAdmission(db) {
    await db.query(`CREATE FUNCTION scoped_repair_lab.dependent_admission(server_id integer,lib_id integer) RETURNS void LANGUAGE plpgsql AS $body$
        DECLARE gate uuid; owner_id integer;
        BEGIN
            IF server_id IS NOT NULL THEN
                SELECT cleanup_job INTO gate FROM scoped_repair_lab.sync_servers WHERE id=server_id FOR SHARE NOWAIT;
                IF NOT FOUND OR gate IS NOT NULL THEN RAISE EXCEPTION 'Dependent server admission closed' USING ERRCODE='55000'; END IF;
            END IF;
            IF lib_id IS NOT NULL THEN
                SELECT cleanup_job,media_server_id INTO gate,owner_id FROM scoped_repair_lab.sync_libraries WHERE id=lib_id FOR SHARE NOWAIT;
                IF NOT FOUND OR gate IS NOT NULL OR (server_id IS NOT NULL AND owner_id<>server_id) THEN
                    RAISE EXCEPTION 'Dependent library admission closed' USING ERRCODE='55000';
                END IF;
                IF server_id IS NULL THEN PERFORM scoped_repair_lab.dependent_admission(owner_id,NULL); END IF;
            END IF;
        END $body$;
        CREATE FUNCTION scoped_repair_lab.dependent_item_admit() RETURNS trigger LANGUAGE plpgsql AS $body$
        DECLARE source record;
        BEGIN
            SELECT id,media_server_id,library_id INTO source FROM scoped_repair_lab.scoped_repair_source WHERE id=NEW.item_id FOR SHARE NOWAIT;
            IF NOT FOUND OR EXISTS(SELECT 1 FROM scoped_repair_lab.cleanup_item_claims WHERE item_id=NEW.item_id) THEN
                RAISE EXCEPTION 'Dependent item admission closed' USING ERRCODE='55000';
            END IF;
            PERFORM scoped_repair_lab.dependent_admission(source.media_server_id,source.library_id);
            RETURN NEW;
        END $body$;
        CREATE FUNCTION scoped_repair_lab.dependent_parent_admit() RETURNS trigger LANGUAGE plpgsql AS $body$
        BEGIN PERFORM scoped_repair_lab.dependent_admission(NEW.media_server_id,NEW.library_id); RETURN NEW; END $body$;
        CREATE FUNCTION scoped_repair_lab.dependent_history_admit() RETURNS trigger LANGUAGE plpgsql AS $body$
        DECLARE owner_id integer; old_name text;
        BEGIN
            IF TG_OP='UPDATE' AND OLD.library_id IS NOT NULL AND NEW.library_id IS NULL THEN
                SELECT media_server_id,name INTO owner_id,old_name FROM scoped_repair_lab.sync_libraries WHERE id=OLD.library_id;
                IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()
                    AND granted AND mode='ExclusiveLock' AND classid=${CLEANUP_LOCK_NAMESPACE}::oid AND objid=owner_id::oid AND objsubid=2)
                    AND EXISTS(SELECT 1 FROM scoped_repair_lab.cleanup_jobs WHERE server_id=owner_id AND state='running'
                        AND (kind='server' OR (kind='library' AND target_id=OLD.library_id)))
                    AND NEW.status IS NOT DISTINCT FROM (CASE WHEN OLD.status='completed' THEN 'failed' ELSE OLD.status END)
                    AND NEW.error_message IS NOT DISTINCT FROM (CASE WHEN OLD.status='completed' THEN
                        COALESCE(OLD.error_message,'Library was deleted after this item was classified') ELSE OLD.error_message END)
                    AND NEW.library_name IS NOT DISTINCT FROM (CASE WHEN OLD.status='completed' THEN COALESCE(OLD.library_name,old_name) ELSE OLD.library_name END)
                    AND (to_jsonb(NEW)-ARRAY['library_id','status','library_name','error_message'])=
                        (to_jsonb(OLD)-ARRAY['library_id','status','library_name','error_message']) THEN RETURN NEW; END IF;
                RAISE EXCEPTION 'History detachment requires cleanup protocol' USING ERRCODE='55000';
            END IF;
            PERFORM scoped_repair_lab.dependent_admission(NULL,NEW.library_id); RETURN NEW;
        END $body$;`);
    for (const table of ['cleanup_retries', 'cleanup_previews']) await db.query(`CREATE TRIGGER dependent_admit BEFORE INSERT OR UPDATE
        ON scoped_repair_lab.${table} FOR EACH ROW EXECUTE FUNCTION scoped_repair_lab.dependent_item_admit()`);
    for (const table of ['cleanup_collections', 'cleanup_status']) await db.query(`CREATE TRIGGER dependent_admit BEFORE INSERT OR UPDATE
        ON scoped_repair_lab.${table} FOR EACH ROW EXECUTE FUNCTION scoped_repair_lab.dependent_parent_admit()`);
    await db.query(`CREATE TRIGGER dependent_admit BEFORE INSERT OR UPDATE ON scoped_repair_lab.cleanup_history
        FOR EACH ROW EXECUTE FUNCTION scoped_repair_lab.dependent_history_admit()`);
}
