/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';
import { providerStopConfiguration,providerStopReview } from './providerStopContract.mjs';
import { createDockerStopClient } from './dockerStopClient.mjs';
import { readDockerStopBoundary } from './dockerStopBoundary.mjs';
import { readProviderStopState,readProviderStopHistory,recordProviderStopIntent,recordProviderStopObservation } from './providerStopRepository.mjs';

/** Dedicated connected pg.Client; no inference, restart, clearing, or automatic retry. */
export async function runProviderStopController(client,{ configuration,action,review,signal }) {
  const config = providerStopConfiguration(configuration);
  if (!['inspect','plan','stop'].includes(action)) throw gatewayError('gateway_stop_action_invalid');
  if (action === 'stop') review = providerStopReview(review);
  const connection = new AbortController();
  const disconnected = () => connection.abort();
  client.on('error',disconnected); client.on('end',disconnected);
  const bounded = AbortSignal.any([connection.signal,AbortSignal.timeout(40000),...(signal ? [signal] : [])]);
  let locked = false,intentStarted = false;
  try {
    bounded.throwIfAborted();
    const held = await client.query(`SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory'
      AND pid=pg_backend_pid() AND classid=11435 AND objid=1 AND objsubid=2 AND granted) AS held`);
    if (held.rows[0].held) throw gatewayError('gateway_stop_dedicated_session_required');
    locked = (await client.query('SELECT pg_try_advisory_lock(11435,1) AS acquired')).rows[0].acquired;
    if (!locked) throw gatewayError('gateway_stop_gateway_running');
    await client.query("SET synchronous_commit=on; SET statement_timeout='4s'; SET lock_timeout='2s'");
    const row = await readProviderStopState(client,config),history = await readProviderStopHistory(client,config.requestId);
    if (action === 'inspect') return { requestId: config.requestId,history,recoveryAuthorized: false };
    if (row.active_request !== config.requestId || row.maintenance_receipt) throw gatewayError('gateway_stop_request_changed');
    if (history) throw gatewayError('gateway_stop_already_attempted');
    const read = createDockerStopClient(config,bounded),before = await readDockerStopBoundary(config,read,bounded);
    if (before.status !== 'running' || !before.running || before.pid < 1 || before.paused || before.restarting || before.dead) {
      throw gatewayError('gateway_stop_not_running');
    }
    const expected = { bindingId: row.binding_id,ownerId: row.owner_id,attempts: row.attempts,
      configurationHash: before.configurationHash,networkHash: before.networkHash };
    if (action === 'plan') return { expected,requestId: config.requestId,recoveryAuthorized: false };
    if (Object.keys(expected).some(key => review.expected[key] !== expected[key])) throw gatewayError('gateway_stop_review_changed');
    bounded.throwIfAborted(); intentStarted = true;
    const intentId = await recordProviderStopIntent(client,config,row,review);
    bounded.throwIfAborted();
    await read('stop');
    const after = await readDockerStopBoundary(config,read,bounded);
    if (after.observation !== 'stopped' || after.restartCount !== before.restartCount ||
        after.configurationHash !== before.configurationHash || after.networkHash !== before.networkHash) {
      throw gatewayError('gateway_stop_boundary_changed');
    }
    bounded.throwIfAborted();
    const observationId = await recordProviderStopObservation(client,intentId,after);
    return { intentId,observationId,evidenceKind: 'docker_stop_observed',recoveryAuthorized: false };
  } catch (error) {
    if (intentStarted && error.code !== 'gateway_stop_review_stale') throw gatewayError('gateway_stop_outcome_unknown');
    if (bounded.aborted) throw gatewayError('gateway_stop_cancelled');
    const safe = ['gateway_stop_dedicated_session_required','gateway_stop_gateway_running','gateway_stop_binding_required',
      'gateway_stop_request_changed','gateway_stop_already_attempted','gateway_stop_boundary_refused','gateway_stop_api_unsupported',
      'gateway_stop_boundary_changed','gateway_stop_not_running','gateway_stop_review_changed','gateway_stop_review_stale'];
    throw gatewayError(safe.includes(error.code) ? error.code : 'gateway_stop_unavailable');
  } finally {
    if (locked) { try { await client.query('SELECT pg_advisory_unlock(11435,1)'); } catch { /* Caller closes; no retry. */ } }
    client.removeListener('error',disconnected); client.removeListener('end',disconnected);
  }
}
