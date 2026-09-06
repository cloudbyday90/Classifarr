/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export async function installCleanupAdmission(db) {
    await db.query(`CREATE FUNCTION scoped_repair_lab.cleanup_admit_source() RETURNS trigger LANGUAGE plpgsql AS $body$
        DECLARE server_gate uuid; library_gate uuid; owner_id integer;
        BEGIN
            IF TG_OP='UPDATE' AND (OLD.id,OLD.media_server_id,OLD.external_id) IS DISTINCT FROM
                (NEW.id,NEW.media_server_id,NEW.external_id) THEN
                RAISE EXCEPTION 'Source identity is immutable' USING ERRCODE='55000';
            END IF;
            SELECT cleanup_job INTO server_gate FROM scoped_repair_lab.sync_servers
                WHERE id=NEW.media_server_id FOR SHARE NOWAIT;
            IF NOT FOUND OR server_gate IS NOT NULL THEN
                RAISE EXCEPTION 'Server admission is closed' USING ERRCODE='55000';
            END IF;
            IF NEW.library_id IS NOT NULL THEN
                SELECT cleanup_job,media_server_id INTO library_gate,owner_id FROM scoped_repair_lab.sync_libraries
                    WHERE id=NEW.library_id FOR SHARE NOWAIT;
                IF NOT FOUND OR library_gate IS NOT NULL OR owner_id<>NEW.media_server_id THEN
                    RAISE EXCEPTION 'Library admission is closed or mismatched' USING ERRCODE='55000';
                END IF;
            END IF;
            RETURN NEW;
        END $body$;
        CREATE TRIGGER cleanup_admit_source BEFORE INSERT OR UPDATE ON scoped_repair_lab.scoped_repair_source
            FOR EACH ROW EXECUTE FUNCTION scoped_repair_lab.cleanup_admit_source();
        CREATE FUNCTION scoped_repair_lab.cleanup_admit_library() RETURNS trigger LANGUAGE plpgsql AS $body$
        DECLARE gate uuid;
        BEGIN
            IF TG_OP='UPDATE' THEN
                IF (OLD.id,OLD.media_server_id) IS DISTINCT FROM (NEW.id,NEW.media_server_id) THEN
                    RAISE EXCEPTION 'Library ownership is immutable' USING ERRCODE='55000';
                END IF;
                RETURN NEW;
            END IF;
            SELECT cleanup_job INTO gate FROM scoped_repair_lab.sync_servers
                WHERE id=NEW.media_server_id FOR SHARE NOWAIT;
            IF NOT FOUND OR gate IS NOT NULL OR NEW.cleanup_job IS NOT NULL THEN
                RAISE EXCEPTION 'Library creation admission is closed' USING ERRCODE='55000';
            END IF;
            RETURN NEW;
        END $body$;
        CREATE TRIGGER cleanup_admit_library BEFORE INSERT OR UPDATE ON scoped_repair_lab.sync_libraries
            FOR EACH ROW EXECUTE FUNCTION scoped_repair_lab.cleanup_admit_library();`);
}
