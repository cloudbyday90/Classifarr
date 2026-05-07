/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const __dirname = import.meta.dirname;

describe('Copyright Scripts', () => {
  const repoRoot = path.resolve(__dirname, '../..');

  it('check-copyright script runs without error', () => {
    expect(() => {
      execSync(`node "${path.join(repoRoot, 'scripts', 'check-copyright.mjs')}"`, {
        stdio: 'pipe',
        cwd: repoRoot
      });
    }).not.toThrow();
  });

  it('update-copyright script runs without error', () => {
    expect(() => {
      execSync(`node "${path.join(repoRoot, 'scripts', 'update-copyright.mjs')}"`, {
        stdio: 'pipe',
        cwd: repoRoot
      });
    }).not.toThrow();
  });

  it('generate-contributors creates file', () => {
    execSync(`node "${path.join(repoRoot, 'scripts', 'generate-contributors.mjs')}"`, {
      stdio: 'pipe',
      cwd: repoRoot
    });
    expect(fs.existsSync(path.join(repoRoot, 'CONTRIBUTORS.md'))).toBe(true);
  });

  it('add-copyright-headers preserves shebang on first line', () => {
    const tempDir = fs.mkdtempSync(path.join(repoRoot, '.tmp-copyright-test-'));
    const testFile = path.join(tempDir, 'test-script.js');
    const originalContent = '#!/usr/bin/env node\n\nconsole.log("Hello");\n';

    try {
      fs.writeFileSync(testFile, originalContent, 'utf8');

      const scriptPath = path.join(__dirname, '..', 'add-copyright-headers.mjs');
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');

      const modifiedScript = scriptContent.replace(
        /const FILE_PATTERNS = \[[\s\S]*?\];/,
        `const FILE_PATTERNS = ['${testFile.replace(/\\/g, '\\\\')}'];`
      );

      const tempScript = path.join(tempDir, 'temp-script.mjs');
      fs.writeFileSync(tempScript, modifiedScript, 'utf8');
      execSync(`node "${tempScript}"`, { stdio: 'pipe', cwd: repoRoot });

      const result = fs.readFileSync(testFile, 'utf8');
      const lines = result.split('\n');
      expect(lines[0]).toBe('#!/usr/bin/env node');

      expect(result).toContain('Copyright (C)');
      expect(result).toContain('Classifarr Contributors');

      const shebangIndex = result.indexOf('#!/usr/bin/env node');
      const copyrightIndex = result.indexOf('Copyright (C)');
      expect(shebangIndex).toBeLessThan(copyrightIndex);
      expect(shebangIndex).toBe(0);
    } finally {
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch {
        // Ignore cleanup errors.
      }
    }
  });
});
