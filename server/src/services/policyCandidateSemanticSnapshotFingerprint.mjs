/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { createHash } from 'node:crypto';

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function stableSerialize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Snapshot fingerprints require finite JSON numbers.');
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;

  if (isPlainRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableSerialize(value[key])}`
    )).join(',')}}`;
  }

  throw new TypeError('Snapshot fingerprints require plain JSON-compatible values.');
}

/**
 * Produces a stable content address for a parsed, versioned offline artifact.
 * It never returns the serialized data, raw vectors, or source metadata.
 */
export function createPolicyCandidateSemanticSnapshotFingerprint(value) {
  const digest = createHash('sha256').update(stableSerialize(value), 'utf8').digest('hex');
  return `sha256:${digest}`;
}
