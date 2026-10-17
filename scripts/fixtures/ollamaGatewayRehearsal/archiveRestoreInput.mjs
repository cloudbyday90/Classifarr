/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, stat, chmod, symlink, link, unlink, rm, rmdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { stageArchiveRestoreInput } from '/app/src/ollamaGateway/archiveRestoreInput.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
assert.equal(process.platform, 'linux'); assert.equal(process.geteuid(), 1000);
const parent = await mkdtemp('/tmp/gateway-input-test-');
const source = join(parent, 'source');
const data = Buffer.concat([Buffer.from('PGDMP'), Buffer.alloc(131072, 73)]);
const dump = { bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
try {
  await mkdir(source, { mode: 0o700 });
  const original = join(source, 'gateway.dump');
  await writeFile(original, data, { flag: 'wx', mode: 0o600 });
  const quota = await mkdtemp('/input-quota/gateway-input-test-');
  try {
    await assert.rejects(stageArchiveRestoreInput(source, quota, dump), { code: 'gateway_archive_scratch_full' });
    await assert.rejects(stat(join(quota, 'input')), { code: 'ENOENT' });
  } finally { await rmdir(quota); }
  const workspace = await mkdtemp(join(parent, 'private-'));
  const staged = await stageArchiveRestoreInput(source, workspace, dump);
  assert.equal(staged, join(workspace, 'input', 'gateway.dump'));
  assert.equal((await stat(staged)).mode & 0o777, 0o400);
  assert.notEqual((await stat(staged)).ino, (await stat(original)).ino);
  await assert.rejects(writeFile(staged, 'overwrite'), { code: 'EACCES' });
  // Replacing the shared pathname after checking cannot change native restore's bytes.
  await unlink(original); await writeFile(original, 'PGDMPdifferent', { flag: 'wx', mode: 0o600 });
  assert.deepEqual(await readFile(staged), data);
  await assert.rejects(stageArchiveRestoreInput(source, await mkdtemp(join(parent, 'changed-')), dump),
    { code: 'gateway_archive_restore_mismatch' });
  await writeFile(original, data); await chmod(original, 0o644);
  await assert.rejects(stageArchiveRestoreInput(source, await mkdtemp(join(parent, 'public-')), dump),
    { code: 'gateway_archive_restore_input_failed' });
  await chmod(original, 0o600); await unlink(original);
  await symlink(staged, original);
  await assert.rejects(stageArchiveRestoreInput(source, await mkdtemp(join(parent, 'symlink-')), dump),
    { code: 'gateway_archive_restore_input_failed' });
  await unlink(original); await link(staged, original);
  await assert.rejects(stageArchiveRestoreInput(source, await mkdtemp(join(parent, 'hardlink-')), dump),
    { code: 'gateway_archive_restore_input_failed' });
  await unlink(original); await writeFile(original, data, { mode: 0o600, flag: 'wx' });
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(stageArchiveRestoreInput(source, await mkdtemp(join(parent, 'cancelled-')), dump, cancelled.signal),
    { code: 'gateway_archive_cancelled' });
  process.stdout.write('private_restore_input_passed: exact bytes; distinct inode; read-only copy; shared-path replacement; real low-space refusal before copying; permission/symlink/hardlink/cancellation refusal\n');
} finally {
  assert.equal(dirname(parent), '/tmp'); assert.ok(parent.startsWith('/tmp/gateway-input-test-'));
  // Only this invocation's synthetic private directory, never a supplied archive path.
  await rm(parent, { recursive: true, force: false });
  await assert.rejects(stat(parent), { code: 'ENOENT' });
}
