/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test.each(['server', 'client'])('locked %s brace parser bounds recursion and rewriting while preserving normal expansion', workspace => {
  // Run bounded fixtures in a disposable child, with hard time and heap limits.
  const cwd = fileURLToPath(new URL(workspace === 'server' ? '../../' : '../../../client/', import.meta.url));
  const script = `import assert from 'node:assert/strict'; import { expand } from 'brace-expansion';
    assert.deepEqual(expand('file{1..3}.{js,mjs}'), ['file1.js','file1.mjs','file2.js','file2.mjs','file3.js','file3.mjs']);
    for (const input of ['{'+'{a},'.repeat(8000)+'b}', '{'.repeat(4000)+'a,b'+'}'.repeat(4000),
      '{a,' .repeat(4200)+'z'+'}'.repeat(4200), '{a}'+'}'.repeat(16000)+',z}']) {
      assert.ok(Array.isArray(expand(input, { max: 10, maxLength: 100000 })));
    }`;
  expect(() => execFileSync(process.execPath, ['--max-old-space-size=128', '--input-type=module', '--eval', script],
    { cwd, timeout: 5000, maxBuffer: 65536, windowsHide: true, stdio: 'pipe' })).not.toThrow();
});
