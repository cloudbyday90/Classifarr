/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export async function setupObservationScanTables(db) {
    await db.query(`CREATE TEMP TABLE library_observation_sampling_state (LIKE public.library_observation_sampling_state INCLUDING ALL) ON COMMIT DROP;
        CREATE TEMP TABLE library_observation_points (LIKE public.library_observation_points INCLUDING ALL) ON COMMIT DROP;
        CREATE TEMP TABLE library_profile_inventory_state (LIKE public.library_profile_inventory_state INCLUDING ALL) ON COMMIT DROP;
        CREATE TEMP TABLE library_observation_scan_progress (LIKE public.library_observation_scan_progress INCLUDING ALL) ON COMMIT DROP;
        CREATE TEMP TABLE libraries (id integer PRIMARY KEY,name text,is_active boolean) ON COMMIT DROP;
        CREATE TEMP TABLE media_server_items (id integer PRIMARY KEY,library_id integer,media_type text,tmdb_id integer,
            metadata jsonb,inventory_tmdb_attempted_at timestamptz,inventory_tmdb_fetched_at timestamptz) ON COMMIT DROP;
        CREATE INDEX ON media_server_items(library_id,id);
        CREATE TEMP TABLE tmdb_config (is_active boolean,api_key text) ON COMMIT DROP;
        CREATE TEMP TABLE task_queue (task_type text,status text,payload jsonb) ON COMMIT DROP;
        INSERT INTO library_observation_sampling_state(singleton) VALUES(true);
        INSERT INTO libraries VALUES(1,'PRIVATE',true),(2,'PRIVATE',true),(3,'Inactive',false);
        INSERT INTO media_server_items VALUES(1,1,'movie',7,'{}',NULL,NULL),(2,2,'tv',8,'{}',NULL,NULL);
        INSERT INTO tmdb_config VALUES(true,'PRIVATE')`);
}
