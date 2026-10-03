/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const retryable = new Set(['not_present', 'unavailable']);
const projection = row => ({ enabled: row?.enabled === true && row.automatic_attempts < 3, attempts: row?.automatic_attempts ?? 0,
  nextCheckAt: row?.next_check_at ?? null, lastResult: row?.last_result ?? 'off', limit: 3 });

export function createManualRoutingCheckState({ db, random = Math.random }) {
  const transaction = fn => db.withTransaction(async client => {
    await client.query("SET LOCAL statement_timeout='2000ms'");
    await client.query("SET LOCAL lock_timeout='250ms'");
    return fn(client);
  });
  return {
    async read(id) {
      const { rows: [row] } = await db.query('SELECT * FROM manual_routing_check_state WHERE classification_id=$1', [id]);
      return projection(row);
    },
    async setEnabled(id, attemptId, enabled) {
      return transaction(async client => {
        if (enabled) await client.query(`INSERT INTO manual_routing_check_state(classification_id,attempt_id)
          VALUES($1,$2) ON CONFLICT(classification_id) DO NOTHING`, [id, attemptId]);
        const { rows: [row] } = await client.query(`UPDATE manual_routing_check_state
          SET enabled=$3 AND automatic_attempts<3, updated_at=NOW()
          WHERE classification_id=$1 AND ($3 IS FALSE OR attempt_id=$2) RETURNING *`, [id, attemptId, enabled]);
        return projection(row);
      });
    },
    async next() {
      const { rows: [row] } = await db.query(`SELECT classification_id FROM manual_routing_check_state
        WHERE enabled IS TRUE AND automatic_attempts<3 AND next_check_at<=NOW()
        ORDER BY next_check_at,classification_id LIMIT 1`);
      return row?.classification_id ?? null;
    },
    async claim(id, attemptId, automatic) {
      return transaction(async client => {
        if (!automatic) await client.query(`INSERT INTO manual_routing_check_state(classification_id,attempt_id)
          VALUES($1,$2) ON CONFLICT(classification_id) DO NOTHING`, [id, attemptId]);
        const { rows: [row] } = await client.query(`SELECT *, next_check_at<=NOW() AS due
          FROM manual_routing_check_state WHERE classification_id=$1 FOR UPDATE`, [id]);
        if (!row || row.attempt_id !== attemptId) return { reason: 'not_eligible' };
        if (automatic && (!row.enabled || row.automatic_attempts >= 3)) return { reason: 'off' };
        if (!row.due) return { reason: 'cooldown', nextCheckAt: row.next_check_at };
        const attempts = row.automatic_attempts + (automatic ? 1 : 0);
        const delay = automatic ? (attempts === 1 ? 300 : 900) + Math.floor(random() * 31) : 60;
        await client.query(`UPDATE manual_routing_check_state SET automatic_attempts=$2::smallint,
          next_check_at=NOW()+$3::double precision*INTERVAL '1 second',
          last_result='checking', updated_at=NOW() WHERE classification_id=$1`, [id, attempts, delay]);
        return { admitted: true };
      });
    },
    async defer(id, reason, nextCheckAt) {
      await db.query(`UPDATE manual_routing_check_state SET last_result=$2,
        next_check_at=CASE WHEN $3::timestamptz<=NOW() THEN NOW()+INTERVAL '5 minutes'
          ELSE GREATEST(NOW()+INTERVAL '60 seconds', LEAST($3::timestamptz, NOW()+INTERVAL '5 minutes')) END,
        updated_at=NOW() WHERE classification_id=$1 AND enabled IS TRUE`, [id, reason, nextCheckAt]);
    },
    async finish(id, reason, { providerFailure = false, automatic = false } = {}) {
      await db.query(`UPDATE manual_routing_check_state SET last_result=$2,
        automatic_attempts=GREATEST(0,automatic_attempts-$4::integer),
        enabled=enabled AND $3 AND (automatic_attempts-$4::integer)<3, updated_at=NOW() WHERE classification_id=$1`,
      [id, reason, providerFailure || retryable.has(reason), providerFailure && automatic ? 1 : 0]);
    },
  };
}
