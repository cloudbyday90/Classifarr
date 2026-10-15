/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';

export async function recordGatewayPeer(query,{ requestId,owner,providerHash,peer }) {
  if (!peer || Object.keys(peer).length !== 2 || ['publicKeySha256','certificateSha256'].some(key =>
    typeof peer[key] !== 'string' || !/^[a-f0-9]{64}$/.test(peer[key]))) throw gatewayError('gateway_upstream_identity_failed');
  // Autocommit only: no transaction spans the TLS handshake or HTTP dispatch.
  const result = await query(`INSERT INTO ollama_gateway.upstream_peer_observation
    (binding_id,public_key_sha256,certificate_sha256)
    SELECT b.id,$4,$5 FROM ollama_gateway.request_binding b JOIN ollama_gateway.admission a ON a.id=b.ledger_id
    WHERE a.singleton AND a.version=5 AND a.owner_id=$2 AND a.provider_hash=$3
      AND a.active_request=$1 AND a.maintenance_receipt IS NULL
      AND b.request_id=$1 AND b.owner_id=$2 AND b.provider_hash=$3 AND b.attempt=a.attempts
    RETURNING id`,[requestId,owner,providerHash,peer.publicKeySha256,peer.certificateSha256]);
  if (result.rowCount !== 1) throw gatewayError('gateway_ledger_unavailable');
}

export async function readGatewayPeer(client,bindingId) {
  const { rows } = await client.query(`SELECT id,public_key_sha256,certificate_sha256,recorded_at
    FROM ollama_gateway.upstream_peer_observation WHERE binding_id=$1`,[bindingId]);
  return rows[0] ? { ...rows[0],evidenceKind: 'tls_peer_authenticated',recoveryAuthorized: false } : null;
}
