/**
 * Converts all jest.unstable_mockModule calls that use the manual
 * `{ ...obj, default: obj }` pattern to use `createMockModule(obj)` from
 * the shared test helper, and injects the import if not already present.
 *
 * Only converts the exact two-property pattern — skips objects with extra
 * properties (e.g. `{ ...db, default: db, DB_ADVISORY_LOCKS: ... }`) or
 * ones where the spread variable and the default variable differ.
 *
 * Patterns converted:
 *   () => ({ ...FOO, default: FOO })
 *   () => ({ ...FOO, default: FOO, })     (trailing comma)
 *
 * Skip conditions:
 *   - More than two entries in the object (extra keys alongside spread+default)
 *   - Spread variable !== default variable
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const TEST_DIR = new URL('../server/src/__tests__', import.meta.url).pathname
  .replace(/^\/([A-Z]:)/, '$1'); // fix Windows drive letter from URL

const IMPORT_PATH_FROM_ROOT = "import { createMockModule } from './helpers/mockFactory.mjs';";
const IMPORT_PATH_FROM_SERVICES = "import { createMockModule } from '../helpers/mockFactory.mjs';";

/**
 * Detects the relative depth from the __tests__ root to decide which import
 * path to inject. Files directly in __tests__/ use './helpers/', files in
 * __tests__/services/ use '../helpers/'.
 */
function importLineFor(filePath) {
  const rel = relative(TEST_DIR, filePath).replace(/\\/g, '/');
  // e.g. "services/aiPromptBuilder.test.mjs" has one sub-dir level
  return rel.includes('/') ? IMPORT_PATH_FROM_SERVICES : IMPORT_PATH_FROM_ROOT;
}

// Regex: () => ({ ...VAR, default: VAR }) or () => ({ ...VAR, default: VAR, })
// The VAR must be the same identifier in both positions.
// We DON'T match if there's more content after `default: VAR` before the closing `})`
const SIMPLE_PATTERN =
  /\(\) => \(\{ \.\.\.([A-Za-z_$][A-Za-z0-9_$]*), default: \1,? \}\)/g;

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      files.push(full);
    }
  }
  return files;
}

let totalFiles = 0;
let totalReplacements = 0;

for (const filePath of walk(TEST_DIR)) {
  const original = readFileSync(filePath, 'utf8');
  const matches = [...original.matchAll(SIMPLE_PATTERN)];
  if (matches.length === 0) continue;

  let updated = original.replace(SIMPLE_PATTERN, '() => createMockModule($1)');
  totalReplacements += matches.length;

  // Inject import if not already present
  const importLine = importLineFor(filePath);
  if (!updated.includes('createMockModule')) {
    // Should not happen since we just replaced, but guard anyway
  }
  if (!updated.includes("from './helpers/mockFactory.mjs'") &&
      !updated.includes("from '../helpers/mockFactory.mjs'")) {
    // Insert after the last existing import block
    // Find the last import statement line
    const importEndMatch = [...updated.matchAll(/^import .+;$/gm)];
    if (importEndMatch.length > 0) {
      const lastImport = importEndMatch[importEndMatch.length - 1];
      const insertPos = lastImport.index + lastImport[0].length;
      updated = updated.slice(0, insertPos) + '\n' + importLine + updated.slice(insertPos);
    } else {
      // No imports — prepend
      updated = importLine + '\n' + updated;
    }
  }

  if (updated !== original) {
    writeFileSync(filePath, updated, 'utf8');
    totalFiles++;
    const rel = relative(TEST_DIR, filePath).replace(/\\/g, '/');
    console.log(`  patched ${rel} (${matches.length} replacement${matches.length > 1 ? 's' : ''})`);
  }
}

console.log(`\nDone: ${totalReplacements} replacements across ${totalFiles} files.`);
