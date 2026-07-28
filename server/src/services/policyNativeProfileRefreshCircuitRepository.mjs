/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildPolicyNativeProfileRefreshCircuitFailureTransition,
  buildPolicyNativeProfileRefreshCircuitProbeDeferral,
  buildPolicyNativeProfileRefreshCircuitProbeTransition,
  normalizeBaseSourceEventId,
  normalizePolicyNativeProfileRefreshCircuit,
} from './policyNativeProfileRefreshCircuit.mjs';
import {
  requireTransactionClient,
} from './policyProfileRefreshOutboxRepository.mjs';

const POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_TABLE =
  'policy_native_profile_refresh_circuits';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function requireCircuitKey({ libraryId, sourceEventId } = {}) {
  const normalizedLibraryId = normalizePositiveInteger(libraryId);
  const normalizedSourceEventId = normalizeBaseSourceEventId(sourceEventId);
  if (!normalizedLibraryId || !normalizedSourceEventId) {
    throw new TypeError('Native profile refresh circuit requires a library and base source event.');
  }
  return { libraryId: normalizedLibraryId, sourceEventId: normalizedSourceEventId };
}

function normalizeCircuitRow(row) {
  return normalizePolicyNativeProfileRefreshCircuit(row);
}

async function lockPolicyNativeProfileRefreshCircuit({
  client,
  libraryId,
  sourceEventId,
} = {}) {
  requireTransactionClient(client);
  const key = requireCircuitKey({ libraryId, sourceEventId });
  const result = await client.query(
    `SELECT circuit_state, consecutive_failure_count, last_terminal_outbox_id,
            last_failure_code, opened_at, next_probe_at, probe_outbox_id
     FROM ${POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_TABLE}
     WHERE library_id = $1
       AND source_event_id = $2
     FOR UPDATE`,
    [key.libraryId, key.sourceEventId],
  );

  return normalizeCircuitRow(firstRow(result));
}

async function ensurePolicyNativeProfileRefreshCircuit({
  client,
  libraryId,
  sourceEventId,
} = {}) {
  requireTransactionClient(client);
  const key = requireCircuitKey({ libraryId, sourceEventId });
  await client.query(
    `INSERT INTO ${POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_TABLE} (
       library_id, source_event_id
     )
     VALUES ($1, $2)
     ON CONFLICT (library_id, source_event_id) DO NOTHING`,
    [key.libraryId, key.sourceEventId],
  );

  return lockPolicyNativeProfileRefreshCircuit({ client, ...key });
}

async function persistPolicyNativeProfileRefreshCircuit({
  client,
  libraryId,
  sourceEventId,
  circuit,
} = {}) {
  requireTransactionClient(client);
  const key = requireCircuitKey({ libraryId, sourceEventId });
  const normalizedCircuit = normalizePolicyNativeProfileRefreshCircuit(circuit);
  if (!normalizedCircuit?.valid) {
    throw new TypeError('Native profile refresh circuit persistence requires a valid circuit state.');
  }

  const result = await client.query(
    `UPDATE ${POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_TABLE}
     SET circuit_state = $1,
         consecutive_failure_count = $2,
         last_terminal_outbox_id = $3,
         last_failure_code = $4,
         opened_at = $5,
         next_probe_at = $6,
         probe_outbox_id = $7,
         updated_at = NOW()
     WHERE library_id = $8
       AND source_event_id = $9
     RETURNING circuit_state, consecutive_failure_count, last_terminal_outbox_id,
               last_failure_code, opened_at, next_probe_at, probe_outbox_id`,
    [
      normalizedCircuit.circuitState,
      normalizedCircuit.consecutiveFailureCount,
      normalizedCircuit.lastTerminalOutboxId,
      normalizedCircuit.lastFailureCode,
      normalizedCircuit.openedAt,
      normalizedCircuit.nextProbeAt,
      normalizedCircuit.probeOutboxId,
      key.libraryId,
      key.sourceEventId,
    ],
  );

  return normalizeCircuitRow(firstRow(result));
}

async function recordPolicyNativeProfileRefreshCircuitFailure({
  client,
  libraryId,
  sourceEventId,
  failedOutboxId,
  failureCount,
  failureCode,
  now = new Date(),
} = {}) {
  const key = requireCircuitKey({ libraryId, sourceEventId });
  const circuit = await ensurePolicyNativeProfileRefreshCircuit({ client, ...key });
  const transition = buildPolicyNativeProfileRefreshCircuitFailureTransition({
    circuit,
    failedOutboxId,
    failureCount,
    failureCode,
    now,
  });

  if (!transition.ready || !transition.changed) {
    return transition;
  }

  return {
    ...transition,
    circuit: await persistPolicyNativeProfileRefreshCircuit({
      client,
      ...key,
      circuit: transition.circuit,
    }),
  };
}

async function startPolicyNativeProfileRefreshCircuitProbe({
  client,
  libraryId,
  sourceEventId,
  probeOutboxId,
  now = new Date(),
} = {}) {
  const key = requireCircuitKey({ libraryId, sourceEventId });
  const circuit = await lockPolicyNativeProfileRefreshCircuit({ client, ...key });
  const transition = buildPolicyNativeProfileRefreshCircuitProbeTransition({
    circuit,
    probeOutboxId,
    now,
  });

  if (!transition.ready) return transition;

  return {
    ...transition,
    circuit: await persistPolicyNativeProfileRefreshCircuit({
      client,
      ...key,
      circuit: transition.circuit,
    }),
  };
}

async function deferPolicyNativeProfileRefreshCircuitProbe({
  client,
  libraryId,
  sourceEventId,
  now = new Date(),
} = {}) {
  const key = requireCircuitKey({ libraryId, sourceEventId });
  const circuit = await lockPolicyNativeProfileRefreshCircuit({ client, ...key });
  const transition = buildPolicyNativeProfileRefreshCircuitProbeDeferral({ circuit, now });

  if (!transition.ready) return transition;

  return {
    ...transition,
    circuit: await persistPolicyNativeProfileRefreshCircuit({
      client,
      ...key,
      circuit: transition.circuit,
    }),
  };
}

async function clearPolicyNativeProfileRefreshCircuitsForLibrary({ client, libraryId } = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Native profile refresh circuit clearing requires a database client.');
  }
  const normalizedLibraryId = normalizePositiveInteger(libraryId);
  if (!normalizedLibraryId) return 0;

  const result = await client.query(
    `DELETE FROM ${POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_TABLE}
     WHERE library_id = $1
     RETURNING library_id`,
    [normalizedLibraryId],
  );

  return Array.isArray(result?.rows) ? result.rows.length : 0;
}

const policyNativeProfileRefreshCircuitRepository = Object.freeze({
  clearForLibrary: clearPolicyNativeProfileRefreshCircuitsForLibrary,
  deferProbe: deferPolicyNativeProfileRefreshCircuitProbe,
  lock: lockPolicyNativeProfileRefreshCircuit,
  recordFailure: recordPolicyNativeProfileRefreshCircuitFailure,
  startProbe: startPolicyNativeProfileRefreshCircuitProbe,
});

export {
  clearPolicyNativeProfileRefreshCircuitsForLibrary,
  deferPolicyNativeProfileRefreshCircuitProbe,
  ensurePolicyNativeProfileRefreshCircuit,
  lockPolicyNativeProfileRefreshCircuit,
  normalizeCircuitRow,
  policyNativeProfileRefreshCircuitRepository,
  POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_TABLE,
  persistPolicyNativeProfileRefreshCircuit,
  recordPolicyNativeProfileRefreshCircuitFailure,
  startPolicyNativeProfileRefreshCircuitProbe,
};
