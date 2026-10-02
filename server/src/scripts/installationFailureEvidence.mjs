/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

const stages = ['refill_lock', 'ingestion_started', 'ingestion_complete', 'metadata_and_profiles', 'crash_pending'];

/** Code locations and known categories only; never assertion values or messages. */
export function installationFailureEvidence(error) {
  const code = typeof error?.code === 'string' && /^(?:[0-9]{2}[A-Z0-9]{3}|P[0-9]{4}|XX[0-9]{3})$/.test(error.code) ? error.code : null;
  const stage = String(error?.message ?? '').startsWith('scheduled_installation_timeout:')
    ? error.message.slice('scheduled_installation_timeout:'.length) : null;
  const locations = [...String(error?.stack ?? '').slice(0, 8192).matchAll(/file:\/\/\/app\/src\/scripts\/([A-Za-z0-9]+\.mjs):([0-9]{1,6}):([0-9]{1,6})/g)]
    .slice(0, 5).map(match => `${match[1]}:${match[2]}:${match[3]}`);
  return { category: error?.code === 'ERR_ASSERTION' ? 'assertion' : stages.includes(stage) ? 'timeout' : code ? 'database' : 'other',
    code, stage: stages.includes(stage) ? stage : null, locations };
}

export function validateInstallationFailure(value) {
  assert.ok(['assertion', 'timeout', 'database', 'other'].includes(value?.category));
  assert.ok(value.code === null || (typeof value.code === 'string' && /^(?:[0-9]{2}[A-Z0-9]{3}|P[0-9]{4}|XX[0-9]{3})$/.test(value.code)));
  assert.ok(value.stage === null || stages.includes(value.stage));
  assert.ok(Array.isArray(value.locations) && value.locations.length <= 5);
  assert.ok(value.locations.every(location => typeof location === 'string' && /^[A-Za-z0-9]+\.mjs:[0-9]{1,6}:[0-9]{1,6}$/.test(location)));
  return { category: value.category, code: value.code, stage: value.stage, locations: [...value.locations] };
}
