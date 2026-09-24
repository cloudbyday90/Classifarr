/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fingerprintMoveFolder, prepareMoveEvidence, verifyMoveEvidence } from '../services/reclassificationMoveEvidence.mjs';
import { assertSeparatePaths, moveProviderIdentity, moveTargetPath } from '../services/reclassificationMoveContract.mjs';

let temp, source, destination;
beforeEach(async () => {
  temp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'classifarr-move-evidence-')));
  source = path.join(temp, 'source'); destination = path.join(temp, 'destination');
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'synthetic.txt'), 'synthetic media bytes');
});
afterEach(async () => { await fs.rm(temp, { recursive: true, force: true }); });
test('content witness survives a real rename and verifies destination without source', async () => {
  const contentDigest = await prepareMoveEvidence(source, destination);
  await fs.rename(source, destination);
  await expect(verifyMoveEvidence({ localOldPath: source, localNewPath: destination, contentDigest })).resolves.toBeUndefined();
});
test('remaining source is never deleted by recovery', async () => {
  const contentDigest = await prepareMoveEvidence(source, destination);
  await fs.cp(source, destination, { recursive: true });
  await expect(verifyMoveEvidence({ localOldPath: source, localNewPath: destination, contentDigest })).rejects.toMatchObject({ code: 'move_source_remains' });
  expect((await fs.stat(source)).isDirectory()).toBe(true);
});
test('different content cannot satisfy the recorded witness', async () => {
  const contentDigest = await prepareMoveEvidence(source, destination);
  await fs.rename(source, destination);
  await fs.writeFile(path.join(destination, 'synthetic.txt'), 'different media bytes');
  await expect(verifyMoveEvidence({ localOldPath: source, localNewPath: destination, contentDigest })).rejects.toMatchObject({ code: 'move_content_changed' });
});
test('missing destination is not successful', async () => {
  await fs.rename(source, path.join(temp, 'elsewhere'));
  await expect(verifyMoveEvidence({ localOldPath: source, localNewPath: destination, contentDigest: 'none' })).rejects.toMatchObject({ code: 'move_destination_missing' });
});
test('preflight rejects existing destinations, empty folders, and bounded work overflow', async () => {
  await fs.mkdir(destination);
  await expect(prepareMoveEvidence(source, destination)).rejects.toMatchObject({ code: 'move_destination_exists' });
  await expect(fingerprintMoveFolder(destination)).rejects.toMatchObject({ code: 'move_content_empty' });
  await expect(fingerprintMoveFolder(source, { maxEntries: 0 })).rejects.toMatchObject({ code: 'move_evidence_limit' });
  await expect(fingerprintMoveFolder(source, { timeoutMs: 0 })).rejects.toThrow('timeout');
});
test('abort prevents continued evidence collection', async () => {
  await expect(fingerprintMoveFolder(source, { signal: AbortSignal.abort(new Error('cancelled')) })).rejects.toThrow('cancelled');
});
test('junction/symlink aliases are rejected', async () => {
  const alias = path.join(temp, 'alias');
  await fs.symlink(source, alias, process.platform === 'win32' ? 'junction' : 'dir');
  await expect(fingerprintMoveFolder(alias)).rejects.toMatchObject({ code: 'move_path_alias' });
  await fs.symlink(destination, path.join(source, 'nested-alias'), process.platform === 'win32' ? 'junction' : 'dir');
  await expect(fingerprintMoveFolder(source)).rejects.toMatchObject({ code: 'move_path_alias' });
});
test('Windows media paths retain only the item basename', () => {
  expect(moveTargetPath('D:\\Movies', 'C:\\Old\\Synthetic (2026)')).toBe('D:/Movies/Synthetic (2026)');
});
test.each([['/media/item', '/media/item'], ['/media/item', '/media/item/child'], ['/', '/media/item'], ['/a/../b', '/c']])('rejects unsafe paths %s and %s', (a, b) => {
  expect(() => assertSeparatePaths(a, b)).toThrow();
});
test('TV identity uses metadata TVDB and never falls back to TMDB; music is excluded', () => {
  expect(moveProviderIdentity({ media_type: 'tv', tmdb_id: 22, metadata: { tvdb_id: 44 } })).toBe(44);
  expect(() => moveProviderIdentity({ media_type: 'tv', tmdb_id: 22 })).toThrow('TVDB');
  expect(() => moveProviderIdentity({ media_type: 'tv', metadata: { tvdb_id: 44, tvdbId: 55 } })).toThrow('conflict');
  expect(() => moveProviderIdentity({ media_type: 'music', tmdb_id: 22 })).toThrow();
});
