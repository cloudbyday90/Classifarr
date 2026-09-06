/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { installRetainedAdmission } from './admission.mjs';

/** Called only by the allowlisted disposable installer, inside its transaction. */
export async function installRetainedReferences(db) {
    await db.query(`ALTER TABLE scoped_repair_lab.cleanup_jobs
        ADD COLUMN requests_detached bigint NOT NULL DEFAULT 0,
        ADD COLUMN feedback_detached bigint NOT NULL DEFAULT 0;
        CREATE TABLE scoped_repair_lab.cleanup_requests (
            id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            routed_to_library_id integer REFERENCES scoped_repair_lab.sync_libraries,
            routed_to_library_name text, library_snapshot jsonb,
            classification_id integer REFERENCES scoped_repair_lab.cleanup_history,
            request_status text NOT NULL DEFAULT 'pending', audit jsonb NOT NULL DEFAULT '{}');
        CREATE INDEX cleanup_requests_library_batch ON scoped_repair_lab.cleanup_requests(routed_to_library_id,id);
        CREATE INDEX ON scoped_repair_lab.cleanup_requests(classification_id);
        CREATE TABLE scoped_repair_lab.cleanup_feedback (
            id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            selected_library_id integer REFERENCES scoped_repair_lab.sync_libraries,
            library_snapshot jsonb, selected_policy_id integer, top_suggestion_library_id integer,
            was_correction boolean NOT NULL DEFAULT false, audit jsonb NOT NULL DEFAULT '{}');
        CREATE INDEX cleanup_feedback_library_batch ON scoped_repair_lab.cleanup_feedback(selected_library_id,id);`);
    await installRetainedAdmission(db);
}
