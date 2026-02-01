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

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Copyright Scripts', () => {
  it('check-copyright script runs without error', () => {
    expect(() => {
      execSync('node scripts/check-copyright.js', { stdio: 'pipe' });
    }).not.toThrow();
  });

  it('update-copyright script runs without error', () => {
    expect(() => {
      execSync('node scripts/update-copyright.js', { stdio: 'pipe' });
    }).not.toThrow();
  });

  it('generate-contributors creates file', () => {
    execSync('node scripts/generate-contributors.js', { stdio: 'pipe' });
    expect(fs.existsSync('CONTRIBUTORS.md')).toBe(true);
  });

  it('add-copyright-headers preserves shebang on first line', () => {
    // Create a temporary test file with a shebang but no copyright header
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copyright-test-'));
    const testFile = path.join(tempDir, 'test-script.js');
    const originalContent = '#!/usr/bin/env node\n\nconsole.log("Hello");\n';
    
    try {
      fs.writeFileSync(testFile, originalContent, 'utf8');
      
      // Use the actual script to add a header
      const scriptPath = path.join(__dirname, '..', 'add-copyright-headers.js');
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      
      // Create a modified version that only processes our test file
      const modifiedScript = scriptContent.replace(
        /const FILE_PATTERNS = \[[\s\S]*?\];/,
        `const FILE_PATTERNS = ['${testFile.replace(/\\/g, '\\\\')}'];`
      );
      
      // Write and execute the modified script
      const tempScript = path.join(tempDir, 'temp-script.js');
      fs.writeFileSync(tempScript, modifiedScript, 'utf8');
      execSync(`node ${tempScript}`, { stdio: 'pipe' });
      
      // Read the result
      const result = fs.readFileSync(testFile, 'utf8');
      
      // Verify shebang is still on first line
      const lines = result.split('\n');
      expect(lines[0]).toBe('#!/usr/bin/env node');
      
      // Verify copyright header is present
      expect(result).toContain('Copyright (C)');
      expect(result).toContain('Classifarr Contributors');
      
      // Verify shebang comes before copyright
      const shebangIndex = result.indexOf('#!/usr/bin/env node');
      const copyrightIndex = result.indexOf('Copyright (C)');
      expect(shebangIndex).toBeLessThan(copyrightIndex);
      expect(shebangIndex).toBe(0);
      
    } finally {
      // Cleanup
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });
});
