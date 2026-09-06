/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CLEANUP_LOCK_NAMESPACE } from '../inventoryCleanup/contract.mjs';
import { RETAINED_REFERENCES } from './definitions.mjs';

export async function installRetainedAdmission(db) {
    await db.query(`CREATE FUNCTION scoped_repair_lab.retained_library_snapshot(lib_id integer,job_id uuid)
        RETURNS jsonb LANGUAGE plpgsql AS $body$
        DECLARE parent record;
        BEGIN
            SELECT * INTO parent FROM scoped_repair_lab.sync_libraries WHERE id=lib_id FOR SHARE NOWAIT;
            IF NOT FOUND THEN RAISE EXCEPTION 'Retained parent missing' USING ERRCODE='55000'; END IF;
            IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()
                AND granted AND mode='ExclusiveLock' AND classid=${CLEANUP_LOCK_NAMESPACE}::oid
                AND objid=parent.media_server_id::oid AND objsubid=2)
                OR NOT EXISTS(SELECT 1 FROM scoped_repair_lab.cleanup_jobs j
                    JOIN scoped_repair_lab.sync_servers s ON s.id=j.server_id
                    WHERE j.id=job_id AND j.state='running' AND j.server_id=parent.media_server_id
                    AND ((j.kind='library' AND j.target_id=lib_id AND parent.cleanup_job=j.id)
                        OR (j.kind='server' AND j.target_id=s.id AND s.cleanup_job=j.id))) THEN
                RAISE EXCEPTION 'Retained detachment requires fenced cleanup' USING ERRCODE='55000';
            END IF;
            RETURN jsonb_build_object('libraryId',parent.id,'mediaServerId',parent.media_server_id,
                'nameAtDetachment',parent.name,'cleanupJobId',job_id,'detachedAt',transaction_timestamp());
        END $body$;`);
    for (const { table, column } of RETAINED_REFERENCES) {
        await db.query(`CREATE FUNCTION scoped_repair_lab.${table}_admit() RETURNS trigger LANGUAGE plpgsql AS $body$
            BEGIN
                IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retained rows cannot be deleted' USING ERRCODE='55000'; END IF;
                IF TG_OP='INSERT' THEN
                    IF NEW.library_snapshot IS NOT NULL THEN RAISE EXCEPTION 'Retained snapshot is cleanup-owned' USING ERRCODE='55000'; END IF;
                    PERFORM scoped_repair_lab.dependent_admission(NULL,NEW.${column}); RETURN NEW;
                END IF;
                IF OLD.${column} IS NOT NULL AND NEW.${column} IS NULL THEN
                    IF OLD.library_snapshot IS NOT NULL OR NEW.library_snapshot IS DISTINCT FROM
                        scoped_repair_lab.retained_library_snapshot(OLD.${column},(NEW.library_snapshot->>'cleanupJobId')::uuid)
                        OR (to_jsonb(NEW)-ARRAY['${column}','library_snapshot']) IS DISTINCT FROM
                            (to_jsonb(OLD)-ARRAY['${column}','library_snapshot']) THEN
                        RAISE EXCEPTION 'Retained detachment changed evidence' USING ERRCODE='55000';
                    END IF;
                    RETURN NEW;
                END IF;
                IF NEW.id IS DISTINCT FROM OLD.id OR NEW.library_snapshot IS DISTINCT FROM OLD.library_snapshot
                    OR (OLD.library_snapshot IS NOT NULL AND NEW.${column} IS NOT NULL) THEN
                    RAISE EXCEPTION 'Retained snapshot and identity are immutable' USING ERRCODE='55000';
                END IF;
                PERFORM scoped_repair_lab.dependent_admission(NULL,OLD.${column});
                IF NEW.${column} IS DISTINCT FROM OLD.${column} THEN
                    PERFORM scoped_repair_lab.dependent_admission(NULL,NEW.${column});
                END IF;
                RETURN NEW;
            END $body$;
            CREATE TRIGGER retained_admit BEFORE INSERT OR UPDATE OR DELETE ON scoped_repair_lab.${table}
                FOR EACH ROW EXECUTE FUNCTION scoped_repair_lab.${table}_admit();`);
    }
}
