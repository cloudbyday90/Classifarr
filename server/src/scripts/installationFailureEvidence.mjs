/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

const stages = ['refill_lock', 'ingestion_started', 'ingestion_complete', 'metadata_and_profiles', 'crash_pending'];

const validStartCounts = value => value && [1, 2].includes(value.expected) &&
  Number.isSafeInteger(value.observed) && value.observed >= 0 && value.observed <= 10000;

/** Fixed categories/locations and optional synthetic counts; never raw messages or arbitrary assertion values. */
export function installationFailureEvidence(error) {
  const code = typeof error?.code === 'string' && /^(?:[0-9]{2}[A-Z0-9]{3}|P[0-9]{4}|XX[0-9]{3})$/.test(error.code) ? error.code : null;
  const stage = String(error?.message ?? '').startsWith('scheduled_installation_timeout:')
    ? error.message.slice('scheduled_installation_timeout:'.length) : null;
  const locations = [...String(error?.stack ?? '').slice(0, 8192).matchAll(/file:\/\/\/app\/src\/scripts\/([A-Za-z0-9]+\.mjs):([0-9]{1,6}):([0-9]{1,6})/g)]
    .slice(0, 5).map(match => `${match[1]}:${match[2]}:${match[3]}`);
  const counts = { expected: error?.expected, observed: error?.actual };
  const taskStarts = error?.code === 'ERR_ASSERTION' && typeof error.message === 'string' &&
    error.message.split('\n', 1)[0] === 'installation_backlog_start_count' &&
    validStartCounts(counts) ? counts : null;
  return { category: error?.code === 'ERR_ASSERTION' ? 'assertion' : stages.includes(stage) ? 'timeout' : code ? 'database' : 'other',
    code, stage: stages.includes(stage) ? stage : null, locations, ...(taskStarts ? { taskStarts } : {}) };
}

export function validateInstallationFailure(value) {
  assert.ok(['assertion', 'timeout', 'database', 'other'].includes(value?.category));
  assert.ok(value.code === null || (typeof value.code === 'string' && /^(?:[0-9]{2}[A-Z0-9]{3}|P[0-9]{4}|XX[0-9]{3})$/.test(value.code)));
  assert.ok(value.stage === null || stages.includes(value.stage));
  assert.ok(Array.isArray(value.locations) && value.locations.length <= 5);
  assert.ok(value.locations.every(location => typeof location === 'string' && /^[A-Za-z0-9]+\.mjs:[0-9]{1,6}:[0-9]{1,6}$/.test(location)));
  if (value.taskStarts !== undefined) {
    assert.equal(value.category, 'assertion');
    assert.ok(validStartCounts(value.taskStarts));
  }
  return { category: value.category, code: value.code, stage: value.stage, locations: [...value.locations],
    ...(value.taskStarts === undefined ? {} : { taskStarts: {
      expected: value.taskStarts.expected, observed: value.taskStarts.observed,
    } }) };
}

export function readInstallationFailure(output) {
  if (typeof output !== 'string') return null;
  const prefix = 'UPGRADE_PROBE_FAILURE ';
  const lines = output.slice(-16384).split(/\r?\n/).filter(line => line.startsWith(prefix));
  if (lines.length !== 1 || lines[0].length > 2048) return null;
  try { return validateInstallationFailure(JSON.parse(lines[0].slice(prefix.length))); }
  catch { return null; }
}
