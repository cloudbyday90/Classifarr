/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './contract.mjs';

/** Dedicated connected pg.Client, never a pool or a shared app database session. */
export async function openGatewayLedger(client, providerHash) {
  const owner = (await client.query('SELECT uuidv7() AS id')).rows[0].id;
  const lock = await client.query('SELECT pg_try_advisory_lock(11435, 1) AS acquired');
  if (!lock.rows[0]?.acquired) throw gatewayError('gateway_already_running');
  const acquired = await client.query(`UPDATE ollama_gateway.admission SET owner_id=$1, provider_hash=$2
    WHERE singleton AND version=1 AND (provider_hash IS NULL OR provider_hash=$2) RETURNING id`, [owner,providerHash]);
  if (acquired.rowCount !== 1) throw gatewayError('gateway_ledger_unavailable');
  let available = true;
  client.on('error', () => { available = false; });
  client.on('end', () => { available = false; });
  const query = async (sql, params = []) => {
    if (!available) throw gatewayError('gateway_ledger_unavailable');
    try { return await client.query(sql, params); }
    catch { available = false; throw gatewayError('gateway_ledger_unavailable'); }
  };
  return {
    async status() {
      const result = await query(`SELECT active_request, started_at, attempts::text,
        cooldown_until, cooldown_until > clock_timestamp() AS cooling
        FROM ollama_gateway.admission WHERE singleton AND version=1 AND owner_id=$1 AND provider_hash=$2`, [owner,providerHash]);
      if (result.rowCount !== 1) throw gatewayError('gateway_ledger_unavailable');
      const row = result.rows[0];
      return { state: row.active_request ? 'uncertain_or_active' : row.cooling ? 'cooldown' : 'ready',
        requestId: row.active_request, startedAt: row.started_at, attempts: row.attempts, cooldownUntil: row.cooldown_until };
    },
    async claim(installation) {
      const result = await query(`UPDATE ollama_gateway.admission SET active_request=uuidv7(), installation=$1,
        started_at=clock_timestamp(), attempts=attempts+1 WHERE singleton AND version=1 AND owner_id=$2
        AND provider_hash=$3 AND active_request IS NULL
        AND (cooldown_until IS NULL OR cooldown_until <= clock_timestamp()) RETURNING active_request`, [installation,owner,providerHash]);
      if (result.rowCount !== 1) throw gatewayError('gateway_admission_deferred');
      return result.rows[0].active_request;
    },
    async complete(requestId, busy = false) {
      const result = await query(`UPDATE ollama_gateway.admission SET active_request=NULL, installation=NULL,
        started_at=NULL, completed_at=clock_timestamp(),
        cooldown_until=CASE WHEN $2 THEN clock_timestamp()+interval '5 seconds' ELSE cooldown_until END
        WHERE singleton AND version=1 AND owner_id=$3 AND active_request=$1 AND provider_hash=$4
        RETURNING id`, [requestId,busy,owner,providerHash]);
      if (result.rowCount !== 1) throw gatewayError('gateway_ledger_unavailable');
    },
  };
}
