/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/* eslint-disable security/detect-non-literal-fs-filename -- internal absolute, realpath-checked operation plans; no request paths */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assertSeparatePaths, moveBlocked } from './reclassificationMoveContract.mjs';

async function exists(target) {
  try { await fs.lstat(target); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function canonical(target) {
  if (!path.isAbsolute(target) || path.resolve(target) === path.parse(target).root ||
      await fs.realpath(target) !== path.resolve(target)) {
    throw moveBlocked('move_path_alias', 'Recovery requires direct filesystem paths without symbolic-link aliases. Check path mappings.');
  }
}

/** A bounded, streamed content witness, not a list of filenames in the database/log. */
export async function fingerprintMoveFolder(folder, { signal, timeoutMs = 300_000, maxEntries = 10_000 } = {}) {
  await canonical(folder);
  const digest = createHash('sha256');
  const deadline = Date.now() + timeoutMs;
  let entries = 0, files = 0;
  function check() {
    signal?.throwIfAborted();
    if (Date.now() >= deadline) throw new Error('move_verification_timeout');
  }
  async function visit(directory, relative, depth) {
    check();
    await canonical(directory);
    const directoryBefore = await fs.lstat(directory);
    if (depth > 32) throw moveBlocked('move_evidence_limit', 'The item folder exceeds the supported verification depth.');
    const names = [];
    const listing = await fs.opendir(directory);
    for await (const entry of listing) {
      check();
      if (entries + names.length >= maxEntries) throw moveBlocked('move_evidence_limit', 'The item folder exceeds the supported verification entry count.');
      names.push(entry.name);
    }
    names.sort();
    for (const name of names) {
      check();
      if (++entries > maxEntries) throw moveBlocked('move_evidence_limit', 'The item folder exceeds the supported verification entry count.');
      const full = path.join(directory, name), key = `${relative}/${name}`;
      const before = await fs.lstat(full);
      if (before.isSymbolicLink() || (!before.isFile() && !before.isDirectory())) {
        throw moveBlocked('move_path_alias', 'Symbolic links and special files require manual inspection before moving.');
      }
      digest.update(JSON.stringify([key, before.isDirectory() ? 'directory' : 'file']));
      if (before.isDirectory()) await visit(full, key, depth + 1);
      else {
        const fileHash = createHash('sha256');
        const handle = await fs.open(full, 'r');
        try {
          for await (const chunk of handle.createReadStream()) { check(); fileHash.update(chunk); }
        } finally { await handle.close(); }
        const after = await fs.lstat(full);
        if (before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
          throw moveBlocked('move_content_changed', 'Media changed while it was being verified; wait for downloads or edits to finish.');
        }
        digest.update(JSON.stringify([before.size, fileHash.digest('hex')]));
        files++;
      }
    }
    const directoryAfter = await fs.lstat(directory);
    if (directoryBefore.ino !== directoryAfter.ino || directoryBefore.mtimeMs !== directoryAfter.mtimeMs) {
      throw moveBlocked('move_content_changed', 'Folder contents changed during verification; wait for downloads or edits to finish.');
    }
  }
  if (!(await fs.lstat(folder)).isDirectory()) throw moveBlocked('move_path_invalid', 'The item path must be a directory.');
  await visit(folder, '', 0);
  if (!files) throw moveBlocked('move_content_empty', 'The item folder contains no verifiable files.');
  return digest.digest('hex');
}

export async function prepareMoveEvidence(source, destination, options) {
  assertSeparatePaths(source, destination);
  await canonical(source);
  await canonical(path.dirname(destination));
  if (await exists(destination)) throw moveBlocked('move_destination_exists', 'The destination already exists. Inspect both folders before retrying.');
  return fingerprintMoveFolder(source, options);
}

export async function verifyMoveEvidence(plan, options) {
  assertSeparatePaths(plan.localOldPath, plan.localNewPath);
  await canonical(path.dirname(plan.localOldPath));
  if (await exists(plan.localOldPath)) throw moveBlocked('move_source_remains', 'The source folder still exists. Inspect source and destination; recovery will not copy or delete either folder. Retry this same destination after resolving the incomplete move.');
  if (!await exists(plan.localNewPath)) throw moveBlocked('move_destination_missing', 'The destination folder is missing. Restore the expected media or path mapping before retrying; do not start another move.');
  if (await fingerprintMoveFolder(plan.localNewPath, options) !== plan.contentDigest) {
    throw moveBlocked('move_content_changed', 'Destination contents do not match the recorded source. Inspect or restore the expected files before retrying this move.');
  }
}
