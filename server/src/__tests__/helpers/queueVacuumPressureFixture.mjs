/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { loadQueueVacuumState } from '../../services/queueVacuumObservation.mjs';

const SETTINGS = Object.freeze({
  autovacuum_enabled: 'true',
  autovacuum_vacuum_threshold: '1000000000',
  autovacuum_vacuum_insert_threshold: '1000000000',
  autovacuum_analyze_threshold: '1000000000',
});

export async function readQueueTableOptions(query) {
  return (await query("SELECT reloptions FROM pg_class WHERE oid = 'public.task_queue'::regclass"))
    .rows[0].reloptions ?? [];
}

function restoreSettings(options) {
  const previous = new Map(options.map(option => option.split('=')));
  return Object.keys(SETTINGS).map(key => {
    if (!previous.has(key)) return `ALTER TABLE public.task_queue RESET (${key})`;
    const value = previous.get(key);
    const valid = key === 'autovacuum_enabled' ? /^(true|false)$/.test(value) : /^-?\d{1,10}$/.test(value);
    if (!valid) throw new Error('Unexpected queue fixture storage parameter');
    return `ALTER TABLE public.task_queue SET (${key} = ${value})`;
  });
}

/** Only used with the integration suite's disposable database. No live configuration. */
export async function withQueueVacuumPressure(pool, run) {
  const writer = await pool.connect();
  const query = (sql, params) => writer.query(sql, params);
  const fixtureId = `vacuum-${randomUUID()}`;
  let library, restore = [];
  try {
    restore = restoreSettings(await readQueueTableOptions(query));
    // Keep autovacuum enabled for real admission, but prevent it from consuming
    // this small synthetic workload between observation and the tested command.
    await query(`ALTER TABLE public.task_queue SET (${Object.entries(SETTINGS)
      .map(([key, value]) => `${key} = ${value}`).join(', ')})`);
    library = (await query(`INSERT INTO libraries (external_id, name, media_type)
      VALUES ($1, 'Synthetic vacuum fixture', 'movie') RETURNING id`, [fixtureId])).rows[0].id;
    await query(`INSERT INTO media_server_items (library_id, external_id, title, media_type, enrichment_status)
      VALUES ($1, $2, 'Synthetic fixture', 'movie', 'not_needed')`, [library, fixtureId]);
    await query(`INSERT INTO task_queue (task_type, payload, status)
      SELECT $1, '{}', 'completed' FROM generate_series(1, 15000)`, [fixtureId]);
    await query('DELETE FROM task_queue WHERE task_type = $1', [fixtureId]);
    await query('SELECT pg_stat_force_next_flush()');
    await query('SELECT 1'); // Flush at the end of the writer's transaction before another session observes.
    const before = await loadQueueVacuumState(query);
    if (!Number.isFinite(Number(before?.n_dead_tup)) || Number(before.n_dead_tup) < 10000) {
      throw new Error('Synthetic queue pressure was not observed');
    }
    const epoch = `${before.relation_oid}:${before.stats_reset == null ? 'initial' : new Date(before.stats_reset).toISOString()}`;
    // Seed admission history, not a claim of an elapsed wall-clock cooldown.
    await query(`UPDATE queue_vacuum_recovery_state SET statistics_epoch = $1,
      vacuum_progress = $2, pressure_since = clock_timestamp() - INTERVAL '2 hours',
      observed_at = clock_timestamp() - INTERVAL '15 minutes'`,
    [epoch, `${before.vacuum_count}:${before.autovacuum_count}`]);
    return await run(before);
  } finally {
    try {
      await query('DELETE FROM task_queue WHERE task_type = $1', [fixtureId]);
      if (library !== undefined) {
        await query('DELETE FROM media_server_items WHERE library_id = $1', [library]);
        await query('DELETE FROM libraries WHERE id = $1', [library]);
      }
    } finally {
      try {
        // Restore only edited keys, including absent versus explicitly set values.
        for (const sql of restore) await query(sql);
      } finally { writer.release(true); }
    }
  }
}
