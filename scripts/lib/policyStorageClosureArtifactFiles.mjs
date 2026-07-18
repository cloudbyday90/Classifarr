/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import fs from 'node:fs';
import path from 'node:path';

function resolvePolicyStorageClosureArtifactPath(cwd, filePath) {
  return path.resolve(cwd, filePath);
}

function readPolicyStorageClosureArtifactJson({
  cwd,
  filePath,
  label,
  required = false,
} = {}) {
  if (!filePath) {
    if (required) {
      throw new Error(`Missing required ${label} JSON path.`);
    }

    return {};
  }

  const resolvedPath = resolvePolicyStorageClosureArtifactPath(cwd, filePath);

  try {
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read ${label} JSON at ${resolvedPath}: ${err.message}`);
  }
}

function writePolicyStorageClosureArtifactJson({
  cwd,
  filePath,
  value,
} = {}) {
  if (!filePath) {
    return;
  }

  const resolvedPath = resolvePolicyStorageClosureArtifactPath(cwd, filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(value, null, 2)}\n`);
}

export {
  readPolicyStorageClosureArtifactJson,
  resolvePolicyStorageClosureArtifactPath,
  writePolicyStorageClosureArtifactJson,
};
