/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function assertCompatibleWorkerEnvironment(environment, { uid, gid, platform, cwd }) {
  if (platform !== 'linux' || !Number.isSafeInteger(uid) || uid <= 0 || !Number.isSafeInteger(gid) || gid <= 0
    || cwd !== '/app'
    || environment.CLASSIFARR_RUNTIME_MODE !== 'normal' || environment.CLASSIFARR_SCHEMA_MAINTENANCE !== 'startup'
    || environment.POSTGRES_HOST !== 'localhost' || environment.POSTGRES_PORT !== '5432'
    || environment.POSTGRES_DB !== 'classifarr' || environment.POSTGRES_USER !== 'classifarr'
    || environment.CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL !== undefined
    || environment.CLASSIFARR_IMAGE_INDEX_CHANNEL !== undefined
    || environment.CLASSIFARR_EMBEDDED_SCHEMA_HANDOFF !== undefined) {
    throw new Error('compatible_queue_worker_environment_invalid');
  }
}

/** Fixed local identity, not an isolated-role assertion or privilege fallback. */
export async function assertCompatibleWorkerDatabase(database) {
  const client = await database.pool.connect();
  try {
    await client.query("SET statement_timeout = '3s'");
    const result = await client.query("SELECT current_user = 'classifarr' AND session_user = 'classifarr' AND current_database() = 'classifarr' AS compatible");
    if (result.rows[0]?.compatible !== true) throw new Error('compatible_queue_database_invalid');
  } finally { client.release(true); }
}
