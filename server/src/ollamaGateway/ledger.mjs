/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './contract.mjs';
import { gatewayProviderInstance } from './providerInstance.mjs';
import { claimGatewayRequest } from './requestBindingRepository.mjs';
import { recordGatewayPeer } from './upstreamPeerRepository.mjs';

/** Dedicated connected pg.Client, never a pool or a shared app database session. */
export async function openGatewayLedger(client, providerHash, instance = null) {
  const providerInstance = instance === null ? null : gatewayProviderInstance(instance);
  await client.query('SET synchronous_commit=on');
  const owner = (await client.query('SELECT uuidv7() AS id')).rows[0].id;
  const lock = await client.query('SELECT pg_try_advisory_lock(11435, 1) AS acquired');
  if (!lock.rows[0]?.acquired) throw gatewayError('gateway_already_running');
  const acquired = await client.query(`UPDATE ollama_gateway.admission SET owner_id=$1, provider_hash=$2
    WHERE singleton AND version=6 AND (provider_hash IS NULL OR provider_hash=$2) RETURNING id`, [owner,providerHash]);
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
      const result = await query(`SELECT a.active_request, a.started_at, a.attempts::text, a.binding_count,
        a.maintenance_receipt, a.cooldown_until, a.cooldown_until > clock_timestamp() AS cooling,
        b.id AS binding_id, b.evidence_kind
        FROM ollama_gateway.admission a LEFT JOIN ollama_gateway.request_binding b ON b.request_id=a.active_request
        WHERE a.singleton AND a.version=6 AND a.owner_id=$1 AND a.provider_hash=$2`, [owner,providerHash]);
      if (result.rowCount !== 1) throw gatewayError('gateway_ledger_unavailable');
      const row = result.rows[0];
      return { state: row.maintenance_receipt ? 'maintenance' : row.active_request ? 'uncertain_or_active' : row.binding_count >= 100000 ? 'history_full' : row.cooling ? 'cooldown' : 'ready',
        recoveryReceipt: row.maintenance_receipt,
        bindingCount: row.binding_count,bindingLimit: 100000,
        requestBinding: row.active_request ? { id: row.binding_id,evidenceKind: row.evidence_kind ?? 'legacy_unbound',recoveryAuthorized: false } : null,
        requestId: row.active_request, startedAt: row.started_at, attempts: row.attempts, cooldownUntil: row.cooldown_until };
    },
    async claim(installation,work = null) {
      return claimGatewayRequest(query,{ installation,owner,providerHash,providerInstance,work });
    },
    async recordPeer(requestId,peer) {
      return recordGatewayPeer(query,{ requestId,owner,providerHash,peer });
    },
    async complete(requestId, busy = false) {
      const result = await query(`UPDATE ollama_gateway.admission SET active_request=NULL, installation=NULL,
        started_at=NULL, completed_at=clock_timestamp(),
        cooldown_until=CASE WHEN $2 THEN clock_timestamp()+interval '5 seconds' ELSE cooldown_until END
        WHERE singleton AND version=6 AND owner_id=$3 AND active_request=$1 AND provider_hash=$4
        AND EXISTS (SELECT 1 FROM ollama_gateway.request_binding b WHERE b.request_id=$1
          AND b.owner_id=$3 AND b.provider_hash=$4)
        RETURNING id`, [requestId,busy,owner,providerHash]);
      if (result.rowCount !== 1) throw gatewayError('gateway_ledger_unavailable');
    },
  };
}
