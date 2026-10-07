/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { validateEmbedding } from '../../utils/embeddingValidation.mjs';
import { decodeInventoryDescriptionVectorRows } from '../../services/inventoryDescriptionVectorDecoding.mjs';
import { createInventoryVectorFingerprint } from '../../services/inventoryVectorFingerprint.mjs';
import { sampleColdBuild } from './heapSampling.mjs';
import { createVectorValidationFixture, VECTOR_VALIDATION_STUDY } from './vectorValidationFixture.mjs';

/** Run once in a dedicated process: optimizer history deliberately accumulates. */
export async function measureVectorValidationHistory({ sample = sampleColdBuild, now = () => performance.now() } = {}) {
  const start = now(), deadline = start + VECTOR_VALIDATION_STUDY.deadlineMs;
  const checkDeadline = () => {
    if (now() >= deadline) throw new Error('vector_validation_study_deadline');
  };
  const { rows, templates } = createVectorValidationFixture();
  const { dimensions, count, batchSize, conditioningCalls, rounds } = VECTOR_VALIDATION_STUDY;
  const windows = [], baselines = new Map();
  for (const history of ['parsed', 'structured_clone']) {
    // Outside sampling. Measured rows stay identical after conditioning.
    for (let index = 0; index < conditioningCalls; index++) {
      checkDeadline();
      validateEmbedding(history === 'parsed' ? JSON.parse(rows[index % batchSize].embedding)
        : structuredClone(templates[index % batchSize]), dimensions);
    }
    for (let round = 0; round < rounds; round++) for (const operation of ['decode', 'decode_and_fingerprint']) {
      checkDeadline();
      const started = now();
      const measured = await sample('allocations', () => {
        let checked = 0, checksum = 0;
        const digest = createHash('sha256'), append = createInventoryVectorFingerprint(digest, dimensions);
        for (let offset = 0; offset < count; offset += batchSize) {
          checkDeadline();
          const batch = rows.slice(0, Math.min(batchSize, count - offset));
          const decoded = decodeInventoryDescriptionVectorRows(batch, { dimensions });
          assert.equal(decoded.size, batch.length, 'vector_validation_study_count');
          checked += decoded.size; checksum += decoded.get(batch[0].description_hash)[0];
          if (operation === 'decode_and_fingerprint') for (const [hash, vector] of decoded) append(hash, vector);
        }
        return { checked, checksum, fingerprint: operation === 'decode_and_fingerprint' ? digest.digest('hex') : null };
      });
      checkDeadline();
      assert.equal(measured.value.checked, count, 'vector_validation_study_count');
      assert.equal(measured.value.checksum, Math.ceil(count / batchSize) * templates[0][0], 'vector_validation_study_values');
      assert.ok(operation === 'decode' ? measured.value.fingerprint === null
        : typeof measured.value.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(measured.value.fingerprint),
      'vector_validation_study_fingerprint');
      if (!baselines.has(operation)) baselines.set(operation, measured.value);
      assert.deepEqual(measured.value, baselines.get(operation), 'vector_validation_study_values');
      assert.ok(Number.isSafeInteger(measured.profile?.sampledEstimatedBytes) && measured.profile.sampledEstimatedBytes >= 0,
        'vector_validation_study_profile');
      const validationEstimatedBytes = measured.profile.components?.vector_validation ?? 0;
      assert.ok(Number.isSafeInteger(validationEstimatedBytes) && validationEstimatedBytes >= 0 &&
        validationEstimatedBytes <= measured.profile.sampledEstimatedBytes, 'vector_validation_study_profile');
      windows.push({ history, operation, round, durationMs: now() - started,
        rows: count, components: count * dimensions, estimatedBytes: measured.profile.sampledEstimatedBytes, validationEstimatedBytes });
    }
  }
  return { version: 1, runtime: process.version, ...VECTOR_VALIDATION_STUDY,
    forcedGc: false, equivalence: 'passed', durationMs: now() - start, windows };
}
