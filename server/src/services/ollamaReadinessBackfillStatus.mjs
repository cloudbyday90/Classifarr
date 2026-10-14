/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolveOllamaVerificationCapabilityIdentity } from './ollamaVerificationCapabilityIdentity.mjs';

const MESSAGES = Object.freeze({
  pending: 'First-time verification is pending. It runs automatically in the background; this page can be closed.',
  waiting_for_configuration: 'Save an Ollama host and model before automatic verification can run.',
  waiting_for_libraries: 'Automatic verification is waiting for an active movie or TV library.',
  waiting_for_inventory: 'Automatic verification is waiting for imported media.',
  ingesting: 'Automatic verification is waiting for library import to finish.',
  backfilling: 'Automatic verification is waiting for metadata backfill and queued work to finish.',
  busy: 'Automatic verification is waiting for other background work. It will try again.',
  database_capacity: 'Automatic verification is waiting for database connection capacity.',
  memory_pressure: 'Automatic verification is waiting for memory headroom. Memory safeguards remain enabled.',
  memory_unknown: 'Automatic verification is waiting for reliable memory information.',
  unavailable: 'The last automatic check could not confirm safe conditions. It will try again.',
  readiness_backfill_unavailable: 'The last automatic check could not finish. It will try again; review logs if this persists.',
  checking: 'The automatic verification test has started. This page can be closed.',
  stopped: 'Automatic verification was interrupted. Missing results remain pending after restart.',
  configuration_changed: 'Settings changed during automatic verification. The current configuration will be checked.',
});

export function normalizeReadinessObservation(result) {
  if (result?.status === 'completed') return { status: 'completed', reason: 'completed' };
  if (result?.status === 'checking') return { status: 'checking', reason: 'checking' };
  if (result?.status === 'stopped') return { status: 'waiting', reason: 'stopped' };
  const reason = Object.hasOwn(MESSAGES, result?.reason) && result.reason !== 'pending'
    ? result.reason : 'unavailable';
  return { status: result?.status === 'failed' ? 'failed' : 'waiting', reason };
}

/** Observation is advisory; the saved probe verdict always takes precedence. */
export function projectReadinessBackfill(configuration, row, now = Date.now()) {
  const identity = resolveOllamaVerificationCapabilityIdentity(configuration ?? {});
  if (!identity.applicable || configuration?.ollama_verification_capability_checked_at != null) return null;
  const observed = Date.parse(row?.observed_at);
  const matches = row?.configuration_fingerprint === identity.fingerprint &&
    String(row?.configuration_revision) === String(identity.configurationRevision) &&
    Number.isFinite(observed) && observed <= now && now - observed < 10 * 60_000;
  const reason = matches && row.status !== 'completed' && Object.hasOwn(MESSAGES, row.reason) &&
    !(row.reason === 'checking' && now - observed > 120_000) ? row.reason : 'pending';
  return { status: reason === 'checking' ? 'checking' : 'pending', reason,
    message: MESSAGES[reason], observedAt: matches ? new Date(observed).toISOString() : null };
}
