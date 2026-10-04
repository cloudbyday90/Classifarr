/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { assertEmbeddedStartupPolicy, embeddedStartupFailureMessage } from '../bootstrap/embeddedStartupPolicy.mjs';
import { provisionEmbeddedIdentity } from '../bootstrap/embeddedIdentityProvisioning.mjs';

test.each([{}, { CLASSIFARR_RUNTIME_MODE: 'normal' }, { CLASSIFARR_RUNTIME_MODE: 'restore' },
  { CLASSIFARR_SCHEMA_MAINTENANCE: 'startup' }])('accepts existing valid settings %j', environment => {
  expect(() => assertEmbeddedStartupPolicy(environment)).not.toThrow();
});

test.each([
  ['CLASSIFARR_RUNTIME_MODE', ''], ['CLASSIFARR_RUNTIME_MODE', 'Normal'],
  ['CLASSIFARR_RUNTIME_MODE', ' normal'], ['CLASSIFARR_RUNTIME_MODE', 'private-secret'],
  ['CLASSIFARR_SCHEMA_MAINTENANCE', ''], ['CLASSIFARR_SCHEMA_MAINTENANCE', 'external'],
  ['CLASSIFARR_SCHEMA_MAINTENANCE', 'STARTUP'], ['CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL', 'stdio-v1'],
  ['CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL', ''], ['CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL', 'private-secret'],
  ['CLASSIFARR_IMAGE_INDEX_CHANNEL', 'stdio-v1'], ['CLASSIFARR_IMAGE_INDEX_CHANNEL', ''],
  ['CLASSIFARR_EMBEDDED_SCHEMA_HANDOFF', 'supervised-v1'], ['CLASSIFARR_EMBEDDED_SCHEMA_HANDOFF', ''],
])('rejects %s=%j before even reading accounts', async (key, value) => {
  const read = jest.fn(), run = jest.fn();
  await expect(provisionEmbeddedIdentity({ environment: { [key]: value }, uid: 0, gid: 0, read, run })).rejects.toThrow();
  expect(read).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
});

test.each(['CLASSIFARR_RUNTIME_MODE must be normal or restore',
  'CLASSIFARR_SCHEMA_MAINTENANCE must be startup or external.', 'embedded_external_schema_unsupported',
  'embedded_maintenance_channel_unsupported', 'embedded_schema_handoff_unsupported', 'embedded_nonroot_account_unavailable'])('explains fixed refusal %s', message => {
  const text = embeddedStartupFailureMessage(new Error(message));
  expect(text).toMatch(/^Embedded startup refused before data ownership changes\./);
  expect(text).not.toContain('Check non-root PUID');
});

test.each([undefined, null, new Error('password=private-secret'), new Error('toString')])('does not echo untrusted errors', error => {
  const text = embeddedStartupFailureMessage(error);
  expect(text).toContain('Check non-root PUID');
  expect(text).not.toContain('private-secret');
});

test('entrypoint admission precedes every persistent startup mutation', () => {
  const script = readFileSync(new URL('../../../docker-entrypoint.sh', import.meta.url), 'utf8');
  const admission = script.indexOf('node /app/src/scripts/provisionEmbeddedIdentity.mjs --apply');
  expect(admission).toBeGreaterThan(0);
  for (const mutation of ['mkdir -p', 'chown -R', 'start_postgres_or_exit()']) {
    expect(admission).toBeLessThan(script.indexOf(mutation));
  }
});
