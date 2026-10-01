/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mkdtemp, mkdir, writeFile, rm, link, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectMigrationTree, digestMigrationTree, copyMigrationTree } from '../bootstrap/embeddedMigrationTree.mjs';

let root, source;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'classifarr-cold-tree-'));
  source = join(root, 'source');
  await mkdir(source);
  await mkdir(join(source, 'base'));
  await writeFile(join(source, 'PG_VERSION'), '18\n');
  await writeFile(join(source, 'base', 'page'), Buffer.alloc(1024 * 1024 + 17, 42));
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
test('deterministic digest covers names, empty directories and complete file contents', async () => {
  const original = await digestMigrationTree(source, await inspectMigrationTree(source));
  expect(await digestMigrationTree(source, await inspectMigrationTree(source))).toBe(original);
  await mkdir(join(source, 'empty'));
  expect(await digestMigrationTree(source, await inspectMigrationTree(source))).not.toBe(original);
});
test.each([{ maxEntries: 2 }, { maxBytes: 4 }])('enforces tree budget %j', async limits => {
  await expect(inspectMigrationTree(source, limits)).rejects.toThrow('migration_tree_budget_exceeded');
});
test('rejects root files and hard-linked files', async () => {
  await expect(inspectMigrationTree(join(source, 'PG_VERSION'))).rejects.toThrow('migration_tree_unsupported');
  await link(join(source, 'PG_VERSION'), join(source, 'linked'));
  await expect(inspectMigrationTree(source)).rejects.toThrow('migration_tree_unsupported');
});
// Directory fsync is a Linux deployment operation, exercised by the real Docker drill.
(process.platform === 'linux' ? test : test.skip)('copy is complete, exclusive and leaves source unchanged', async () => {
  const tree = await inspectMigrationTree(source);
  const before = await digestMigrationTree(source, tree);
  const target = join(root, 'candidate');
  await copyMigrationTree(source, target, tree);
  expect(await digestMigrationTree(target, await inspectMigrationTree(target))).toBe(before);
  expect(await readFile(join(source, 'PG_VERSION'), 'utf8')).toBe('18\n');
  await expect(copyMigrationTree(source, target, tree)).rejects.toThrow();
});
