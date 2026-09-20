/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { stageCrossEncoderArtifact } from '../../../../scripts/prepare-cross-encoder-model.mjs';
import { CROSS_ENCODER_ARTIFACTS } from '../../../../scripts/lib/cross-encoder-artifacts.mjs';
const artifact = { url: 'https://example.invalid/never-fetched', sha256: createHash('sha256').update('valid').digest('hex'), maxBytes: 10 };
test('manifest pins safetensors only and each artifact has a hash and size bound', () => {
  expect(CROSS_ENCODER_ARTIFACTS.map(item => item.name)).toEqual(['config.json', 'tokenizer.json', 'model.safetensors']);
  for (const item of CROSS_ENCODER_ARTIFACTS) {
    expect(item.sha256).toMatch(/^[a-f0-9]{64}$/); expect(item.url).toMatch(/\/resolve\/[a-f0-9]{40}\//);
    expect(item.maxBytes).toBeGreaterThan(0);
  }
});
test('optional scorer deployment is private, resource bounded and independent of trusted app loopback', async () => {
  const compose = await readFile(new URL('../../../../docker-compose.cross-encoder.yml', import.meta.url), 'utf8');
  expect(compose).toContain('internal: true'); expect(compose).toContain('networks: [cross_encoder_private]');
  expect(compose).not.toMatch(/network_mode:|ports:|docker\.sock|\/app\/data/);
  expect(compose).toContain('read_only: true'); expect(compose).toContain('user: "1000:1000"');
  expect(compose).toContain('mem_limit: 4g'); expect(compose).toContain('cpus: 2');
  expect(compose).toContain('pull_policy: never'); expect(compose).toContain('no-new-privileges:true');
  expect(compose).toContain('HF_HUB_OFFLINE: "1"'); expect(compose).toContain('healthcheck:');
});
test.each(['valid', 'hash', 'size', 'partial', 'existing', 'http', 'abort'])('artifact staging %s preserves ownership and never overwrites', async kind => {
  const directory = await mkdtemp(join(tmpdir(), 'classifarr-cross-encoder-')), target = join(directory, 'model.safetensors');
  const fetchRequest = jest.fn(async () => new Response(kind === 'hash' ? 'wrong' : kind === 'size' ? 'x'.repeat(11) : 'valid', { status: kind === 'http' ? 503 : 200 }));
  const controller = new AbortController();
  try {
    if (kind === 'partial') await writeFile(`${target}.partial`, 'other owner');
    if (kind === 'existing') await writeFile(target, 'original');
    if (kind === 'abort') controller.abort();
    const run = stageCrossEncoderArtifact(target, artifact, { fetchRequest, signal: controller.signal });
    if (kind === 'valid') { expect(await run).toBe(5); expect(await readFile(target, 'utf8')).toBe('valid'); }
    else await expect(run).rejects.toThrow();
    if (kind === 'partial') { expect(await readFile(`${target}.partial`, 'utf8')).toBe('other owner'); expect(fetchRequest).not.toHaveBeenCalled(); }
    else await expect(readFile(`${target}.partial`)).rejects.toThrow();
    if (kind === 'existing') expect(await readFile(target, 'utf8')).toBe('original');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
