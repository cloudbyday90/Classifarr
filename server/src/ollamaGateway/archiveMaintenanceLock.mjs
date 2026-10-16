/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Separate from the lifetime inference/coordinator locks. Never wait behind maintenance. */
export async function withArchiveMaintenance(client, action) {
  if (!(await client.query('SELECT pg_try_advisory_lock(11435,4) AS acquired')).rows[0].acquired) {
    return { state: 'maintenance_busy', purgeAuthorized: false };
  }
  try { return await action(); }
  finally { await client.query('SELECT pg_advisory_unlock(11435,4)'); }
}
