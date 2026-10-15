/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './contract.mjs';
import { readGatewayPeer } from './upstreamPeerRepository.mjs';

export async function claimGatewayRequest(query,{ installation,owner,providerHash,providerInstance,work = null }) {
  const result = await query(`WITH claimed AS (
    UPDATE ollama_gateway.admission SET active_request=uuidv7(), installation=$1,
      started_at=clock_timestamp(), attempts=attempts+1, binding_count=binding_count+1
    WHERE singleton AND version=5 AND owner_id=$2 AND provider_hash=$3
      AND active_request IS NULL AND maintenance_receipt IS NULL AND binding_count<100000
      AND (cooldown_until IS NULL OR cooldown_until <= clock_timestamp())
    RETURNING id,active_request,started_at,attempts)
    INSERT INTO ollama_gateway.request_binding
      (ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind,
       daemon_id_hash,container_id,image_id,provider_started_at,work_version,operation,model,work_fingerprint,fingerprint_key_id)
    SELECT id,active_request,$2,$3,$1,started_at,attempts,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13 FROM claimed
    RETURNING request_id`,[installation,owner,providerHash,providerInstance ? 'administrator_configured' : 'unbound',
    providerInstance?.daemonIdHash ?? null,providerInstance?.containerId ?? null,
    providerInstance?.imageId ?? null,providerInstance?.startedAt ?? null,work?.version ?? null,
    work?.operation ?? null,work?.model ?? null,work?.fingerprint ?? null,work?.keyId ?? null]);
  if (result.rowCount !== 1) throw gatewayError('gateway_admission_deferred');
  return result.rows[0].request_id;
}

/** Offline diagnostics only. Immutable records cannot authorize recovery. */
export async function readGatewayRequestBinding(client,requestId) {
  if (!requestId) return null;
  const { rows } = await client.query(`SELECT id,evidence_kind,daemon_id_hash,container_id,image_id,provider_started_at,
    installation,work_version,operation,model,work_fingerprint,fingerprint_key_id
    FROM ollama_gateway.request_binding WHERE request_id=$1`,[requestId]);
  const row = rows[0];
  return { requestId,id: row?.id ?? null,evidenceKind: row?.evidence_kind ?? 'legacy_unbound',recoveryAuthorized: false,
    transportEvidence: row ? await readGatewayPeer(client,row.id) : null,
    workIdentity: row?.work_version ? { application: 'classifarr',requestId,installation: row.installation,
      version: row.work_version,operation: row.operation,model: row.model,
      fingerprint: row.work_fingerprint,keyId: row.fingerprint_key_id } : null,
    providerInstance: row?.evidence_kind === 'administrator_configured' ? {
      daemonIdHash: row.daemon_id_hash,containerId: row.container_id,imageId: row.image_id,startedAt: row.provider_started_at,
    } : null };
}
