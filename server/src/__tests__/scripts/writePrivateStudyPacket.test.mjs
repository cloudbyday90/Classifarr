/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from '@jest/globals';

import { writePrivateStudyPacket } from '../../scripts/writePrivateStudyPacket.mjs';

const temporaryDirectory = '.tmp/private-reviewer-packet-test';
const temporaryFile = `${temporaryDirectory}/packet.json`;

describe('writePrivateStudyPacket', () => {
  test('writes only a new owner-only JSON file beneath the project temporary root', async () => {
    await rm(join(process.cwd(), '..', temporaryDirectory), { force: true, recursive: true });
    try {
      await writePrivateStudyPacket(temporaryFile, { private: 'packet' });
      await expect(readFile(join(process.cwd(), '..', temporaryFile), 'utf8')).resolves.toBe(
        '{\n  "private": "packet"\n}\n',
      );
      const mode = (await stat(join(process.cwd(), '..', temporaryFile))).mode & 0o777;
      if (process.platform !== 'win32') expect(mode).toBe(0o600);
      else expect(mode & 0o600).toBe(0o600);
      await expect(writePrivateStudyPacket(temporaryFile, { replacement: true })).rejects.toMatchObject({
        code: 'EEXIST',
      });
    } finally {
      await rm(join(process.cwd(), '..', temporaryDirectory), { force: true, recursive: true });
    }
  });

  test('rejects paths outside the private temporary root', async () => {
    await expect(writePrivateStudyPacket('../packet.json', {})).rejects.toThrow('beneath .tmp');
    await expect(writePrivateStudyPacket('.tmp/private-reviewer-packet-test/packet.txt', {})).rejects.toThrow(
      'project-relative JSON',
    );
  });
});
