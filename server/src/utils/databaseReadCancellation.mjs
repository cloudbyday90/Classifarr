/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// Separate, short-lived control connections cannot wait behind a saturated work
// pool. Admission is bounded and never queued; the read's server timeout is the
// fallback when a control connection is unavailable.
export function createDatabaseReadCanceller({ createClient, logger }) {
  let active = 0;
  return async function cancelRead(identity) {
    if (!Number.isInteger(identity?.pid) || typeof identity?.started !== 'string') return false;
    if (active >= 2) {
      logger?.warn('Database read cancellation unavailable', { reason: 'control_capacity' }, { skipDbPersist: true });
      return false;
    }
    active += 1;
    let client, expired = false, timer;
    // Never retain SQL, parameters, credentials, backend identity or caller abort
    // reasons in logs. An error listener also owns idle connection failures.
    const onError = () => {};
    const operation = (async () => {
      try {
        client = createClient();
        client.on('error', onError);
        await client.connect();
        if (expired) return false;
        const result = await client.query(`
          SELECT pg_cancel_backend(pid) AS cancelled
          FROM pg_stat_activity
          WHERE pid = $1 AND backend_start = $2::timestamptz
            AND datname = current_database() AND usename = current_user
        `, [identity.pid, identity.started]);
        return result.rows[0]?.cancelled === true;
      } catch {
        return false;
      } finally {
        // Keep the admission slot until the connection is actually closed, even
        // if the caller's cleanup deadline has already expired.
        try { await client?.end(); } catch { /* already disconnected */ }
        client?.removeListener('error', onError);
        active -= 1;
      }
    })();
    const deadline = new Promise(resolve => {
      timer = setTimeout(() => {
        expired = true;
        // pg's public end() destroys an active non-pipelined connection.
        Promise.resolve(client?.end()).catch(() => {}); // swallow-error: Deadline reports control_unavailable; the owned finally still closes and releases admission.
        resolve(false);
      }, 1500);
    });
    const cancelled = await Promise.race([operation, deadline]);
    clearTimeout(timer);
    if (!cancelled) logger?.warn('Database read cancellation unavailable',
      { reason: 'control_unavailable' }, { skipDbPersist: true });
    return cancelled;
  };
}
