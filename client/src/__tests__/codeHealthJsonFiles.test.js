/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { collectCodeHealthJsonFiles } from './helpers/codeHealthJsonFiles.js';

test('generated Playwright JSON leaves authored code-health inputs stable', () => {
  const parent = realpathSync(tmpdir());
  const root = mkdtempSync(path.join(parent, 'classifarr-code-health-json-'));
  const write = (name, data) => {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, data);
    return file;
  };

  try {
    const malformed = write('docs/test-results/authored.json', '{');
    const authored = [
      malformed,
      write('client/public/manifest.json', '{}'),
      write('client/src/fixtures/playwright-report/authored.json', '{}'),
    ].sort();
    write('client/package-lock.json', '{}');
    expect(collectCodeHealthJsonFiles(root)).toEqual(authored);

    write('client/test-results/browser/.last-run.json', '{');
    write('client/test-results/production/attachment.json', '{');
    write('client/playwright-report/data/report.json', '{');
    expect(collectCodeHealthJsonFiles(root)).toEqual(authored);
    expect(() => JSON.parse(readFileSync(malformed, 'utf8'))).toThrow(SyntaxError);
  } finally {
    if (path.dirname(realpathSync(root)) === parent) rmSync(root, { recursive: true, force: true });
  }
});
