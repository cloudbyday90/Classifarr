/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createVectorValidationFixture, VECTOR_VALIDATION_STUDY } from '../../scripts/comparisonMemoryStudy/vectorValidationFixture.mjs';
import { measureVectorValidationHistory } from '../../scripts/comparisonMemoryStudy/vectorValidation.mjs';

test('fixture is fixed, bounded and contains valid independent synthetic arrays', () => {
  const fixture = createVectorValidationFixture();
  expect(Object.isFrozen(VECTOR_VALIDATION_STUDY)).toBe(true);
  expect(fixture.rows).toHaveLength(256);
  expect(fixture.templates).toHaveLength(256);
  expect(new Set(fixture.rows.map(row => row.description_hash)).size).toBe(256);
  for (let index = 0; index < fixture.rows.length; index++) {
    expect(fixture.templates[index]).toHaveLength(1024);
    expect(fixture.templates[index]).toEqual(JSON.parse(fixture.rows[index].embedding));
  }
});

test('measures all fixed histories and operations using the real decoder and fingerprint', () => {
  // Run the full numeric workload in native Node, not Jest's cross-realm VM.
  // The production 60-second deadline stays intact; the child also has a hard deadline.
  const moduleUrl = new URL('../../scripts/comparisonMemoryStudy/vectorValidation.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { measureVectorValidationHistory } from ${JSON.stringify(moduleUrl)};
    let calls = 0;
    const receipt = await measureVectorValidationHistory({ sample: async (_mode, work) => {
      calls++; return { value: await work(), profile: { sampledEstimatedBytes: 123 } };
    } });
    process.stdout.write(JSON.stringify({ calls, receipt }));
  `], { shell: false, windowsHide: true, timeout: 30_000, encoding: 'utf8', maxBuffer: 64 * 1024 });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  const { calls, receipt } = JSON.parse(result.stdout);
  expect(calls).toBe(12);
  expect(receipt.equivalence).toBe('passed');
  expect(receipt.forcedGc).toBe(false);
  expect(receipt.windows).toHaveLength(12);
  for (const history of ['parsed', 'structured_clone']) for (const operation of ['decode', 'decode_and_fingerprint']) {
    expect(receipt.windows.filter(row => row.history === history && row.operation === operation)
      .map(row => row.round)).toEqual([0, 1, 2]);
  }
  for (const row of receipt.windows) expect(row).toMatchObject({ rows: 5776, components: 5914624, estimatedBytes: 123 });
  expect(JSON.stringify(receipt)).not.toMatch(/description_hash|fingerprint":|embedding|templates|file:|http/);
}, 40_000);

test.each([['0', []], ['1', ['--count=1']]])('CLI rejects missing opt-in or caller overrides before doing work: %s', (enabled, args) => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/comparisonMemoryStudy/runVectorValidation.mjs', import.meta.url)), ...args], {
    env: { ...process.env, CLASSIFARR_SYNTHETIC_MEMORY_STUDY: enabled }, shell: false, windowsHide: true,
    timeout: 5000, encoding: 'utf8', maxBuffer: 8192,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe('vector_validation_study_failed\n');
});

test('expired monotonic budget fails before a sampler is opened', async () => {
  let time = 0;
  const sample = jest.fn(), now = () => { time += 60_000; return time; };
  await expect(measureVectorValidationHistory({ sample, now })).rejects.toThrow('vector_validation_study_deadline');
  expect(sample).not.toHaveBeenCalled();
});

test.each(['work', 'profile', 'count', 'checksum', 'fingerprint', 'deadline'])('never returns successful evidence after %s failure', async failure => {
  let time = 0, calls = 0;
  const { templates } = createVectorValidationFixture();
  const sample = jest.fn(async () => {
    if (failure === 'work') throw new Error('private sampler failure');
    calls++;
    const value = { checked: 5776, checksum: 23 * templates[0][0], fingerprint: calls % 2 ? null : 'a'.repeat(64) };
    if (failure === 'count') value.checked--;
    if (failure === 'checksum') value.checksum++;
    if (failure === 'fingerprint' && calls === 4) value.fingerprint = 'b'.repeat(64);
    if (failure === 'deadline') time = 60_000;
    return { value, profile: { sampledEstimatedBytes: failure === 'profile' ? NaN : 1 } };
  });
  await expect(measureVectorValidationHistory({ sample, now: () => time })).rejects.toThrow();
  expect(sample.mock.calls.length).toBeLessThanOrEqual(4);
}, 30_000);
