/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CLEANUP_LOCK_NAMESPACE } from './contract.mjs';
import { SCOPED_REPAIR_LOCK_NAMESPACE } from '../libraryScopedRepair/contract.mjs';

export async function installCleanupParentGuards(db) {
    await db.query(`CREATE FUNCTION scoped_repair_lab.cleanup_remove_library() RETURNS trigger LANGUAGE plpgsql AS $body$
        BEGIN
            IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()
                AND granted AND mode='ExclusiveLock' AND classid=${CLEANUP_LOCK_NAMESPACE}::oid
                AND objid=OLD.media_server_id::oid AND objsubid=2)
                OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()
                AND granted AND mode='ExclusiveLock' AND classid=${SCOPED_REPAIR_LOCK_NAMESPACE}::oid
                AND objid=OLD.id::oid AND objsubid=2) THEN
                RAISE EXCEPTION 'Library deletion requires cleanup and library locks' USING ERRCODE='55000';
            END IF;
            IF NOT EXISTS(SELECT 1 FROM scoped_repair_lab.cleanup_jobs j
                LEFT JOIN scoped_repair_lab.sync_servers p ON p.id=OLD.media_server_id
                WHERE j.state='running' AND ((j.kind='library' AND j.target_id=OLD.id AND j.id=OLD.cleanup_job)
                    OR (j.kind='server' AND j.target_id=OLD.media_server_id AND j.id=p.cleanup_job)))
                OR EXISTS(SELECT 1 FROM scoped_repair_lab.scoped_repair_source WHERE library_id=OLD.id) THEN
                RAISE EXCEPTION 'Library deletion requires completed inventory drain' USING ERRCODE='55000';
            END IF;
            RETURN OLD;
        END $body$;
        CREATE TRIGGER cleanup_remove_library BEFORE DELETE ON scoped_repair_lab.sync_libraries
            FOR EACH ROW EXECUTE FUNCTION scoped_repair_lab.cleanup_remove_library();
        CREATE FUNCTION scoped_repair_lab.cleanup_remove_server() RETURNS trigger LANGUAGE plpgsql AS $body$
        BEGIN
            IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()
                AND granted AND mode='ExclusiveLock' AND classid=${CLEANUP_LOCK_NAMESPACE}::oid
                AND objid=OLD.id::oid AND objsubid=2) THEN
                RAISE EXCEPTION 'Server deletion requires cleanup lock' USING ERRCODE='55000';
            END IF;
            IF NOT EXISTS(SELECT 1 FROM scoped_repair_lab.cleanup_jobs j WHERE j.id=OLD.cleanup_job
                AND j.kind='server' AND j.target_id=OLD.id AND j.state='running')
                OR EXISTS(SELECT 1 FROM scoped_repair_lab.scoped_repair_source WHERE media_server_id=OLD.id)
                OR EXISTS(SELECT 1 FROM scoped_repair_lab.sync_libraries WHERE media_server_id=OLD.id) THEN
                RAISE EXCEPTION 'Server deletion requires completed child drain' USING ERRCODE='55000';
            END IF;
            RETURN OLD;
        END $body$;
        CREATE TRIGGER cleanup_remove_server BEFORE DELETE ON scoped_repair_lab.sync_servers
            FOR EACH ROW EXECUTE FUNCTION scoped_repair_lab.cleanup_remove_server();`);
}
