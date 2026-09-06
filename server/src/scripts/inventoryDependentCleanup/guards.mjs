/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export async function installDependentGuards(db) {
    await db.query(`CREATE FUNCTION scoped_repair_lab.dependent_source_guard() RETURNS trigger LANGUAGE plpgsql AS $body$
        BEGIN
            IF EXISTS(SELECT 1 FROM scoped_repair_lab.cleanup_item_claims WHERE item_id=OLD.id) THEN
                RAISE EXCEPTION 'Source is reserved for dependent cleanup' USING ERRCODE='55000';
            END IF;
            RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
        END $body$;
        CREATE TRIGGER dependent_source_guard BEFORE UPDATE OR DELETE ON scoped_repair_lab.scoped_repair_source
            FOR EACH ROW EXECUTE FUNCTION scoped_repair_lab.dependent_source_guard();
        CREATE FUNCTION scoped_repair_lab.dependent_preserve_history() RETURNS trigger LANGUAGE plpgsql AS $body$
        BEGIN RAISE EXCEPTION 'Cleanup history must be preserved' USING ERRCODE='55000'; END $body$;
        CREATE TRIGGER dependent_preserve_history BEFORE DELETE ON scoped_repair_lab.cleanup_history
            FOR EACH ROW EXECUTE FUNCTION scoped_repair_lab.dependent_preserve_history();`);
}
