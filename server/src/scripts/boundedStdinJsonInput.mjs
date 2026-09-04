/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { Buffer } from 'node:buffer';

export const MAX_BOUNDED_STDIN_JSON_BYTES = 128 * 1024;

/**
 * Loads one small JSON document from standard input. This is intentionally a
 * process-only boundary: callers can pass sensitive study metadata without
 * placing it in a repository file, and errors never repeat input content.
 */
export async function loadBoundedStdinJsonInput({
  maximumBytes = MAX_BOUNDED_STDIN_JSON_BYTES,
  stdin = process.stdin,
} = {}) {
  if (!stdin || typeof stdin[Symbol.asyncIterator] !== 'function' ||
      !Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new Error('Standard input is unavailable.');
  }

  const chunks = [];
  let byteLength = 0;
  for await (const chunk of stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += bytes.length;
    if (byteLength > maximumBytes) throw new Error('Standard input exceeds the allowed size.');
    chunks.push(bytes);
  }

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    throw new Error('Standard input must be valid UTF-8 JSON.');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Standard input must be valid JSON.');
  }
}
