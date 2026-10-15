/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';

export async function readProviderStopHistory(client,requestId) {
  if (!requestId) return null;
  const { rows } = await client.query(`SELECT i.id AS intent_id,i.recorded_at AS requested_at,
    o.id AS observation_id,o.recorded_at AS observed_at,o.finished_at,o.exit_code
    FROM ollama_gateway.request_binding b JOIN ollama_gateway.provider_stop_intent i ON i.binding_id=b.id
    LEFT JOIN ollama_gateway.provider_stop_observation o ON o.intent_id=i.id WHERE b.request_id=$1`,[requestId]);
  return rows[0] ? { ...rows[0],evidenceKind: rows[0].observation_id ? 'docker_stop_observed' : 'stop_outcome_unknown',recoveryAuthorized: false } : null;
}

export async function readProviderStopState(client,config) {
  const { rows } = await client.query(`SELECT a.id AS ledger_id,a.owner_id,a.active_request,a.attempts::text,a.maintenance_receipt,
    b.id AS binding_id,b.evidence_kind,b.daemon_id_hash,b.container_id,b.image_id,b.provider_started_at
    FROM ollama_gateway.admission a JOIN ollama_gateway.request_binding b ON b.ledger_id=a.id
    WHERE a.singleton AND a.version=4 AND a.provider_hash=$1 AND b.provider_hash=$1 AND b.request_id=$2`,[config.providerHash,config.requestId]);
  const row = rows[0],pins = config.boundary;
  if (!row || row.evidence_kind !== 'administrator_configured' || row.daemon_id_hash !== pins.daemonIdHash ||
      row.container_id !== pins.containerId || row.image_id !== pins.imageId || row.provider_started_at !== pins.startedAt) {
    throw gatewayError('gateway_stop_binding_required');
  }
  return row;
}

export async function recordProviderStopIntent(client,config,row,review) {
  // One autocommit statement. An uncertain acknowledgement must never be retried.
  const { rows } = await client.query(`INSERT INTO ollama_gateway.provider_stop_intent
    (binding_id,owner_id,attempts,network_id,configuration_hash,network_hash,operator_ref,evidence_ref,reviewed_at)
    SELECT $1,a.owner_id,a.attempts,$2,$3,$4,$5,$6,$7 FROM ollama_gateway.admission a
    WHERE a.id=$8 AND a.version=4 AND a.owner_id=$9 AND a.active_request=$10 AND a.attempts=$11
      AND a.provider_hash=$12 AND a.maintenance_receipt IS NULL
      AND $7::timestamptz<=clock_timestamp() AND $7::timestamptz>=clock_timestamp()-interval '15 minutes'
      AND $7::timestamptz>=a.started_at RETURNING id`,
  [row.binding_id,config.networkId,review.expected.configurationHash,review.expected.networkHash,review.operatorRef,
    review.evidenceRef,review.observedAt,row.ledger_id,row.owner_id,config.requestId,row.attempts,config.providerHash]);
  if (rows.length !== 1) throw gatewayError('gateway_stop_review_stale');
  return rows[0].id;
}

export async function recordProviderStopObservation(client,intentId,snapshot) {
  return (await client.query(`INSERT INTO ollama_gateway.provider_stop_observation(intent_id,finished_at,exit_code)
    VALUES($1,$2,$3) RETURNING id`,[intentId,snapshot.finishedAt,snapshot.exitCode])).rows[0].id;
}
