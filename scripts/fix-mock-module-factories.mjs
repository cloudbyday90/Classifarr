/**
 * fix-mock-module-factories.mjs
 *
 * Fixes test files where `jest.unstable_mockModule(path, () => createMockModule(mockVar))`
 * mocks a service that now uses a named singleton export (Phase 7 pattern).
 *
 * After Phase 7, `import { serviceName } from './service.mjs'` is used everywhere.
 * Test mocks using `createMockModule(mockVar)` don't expose `serviceName` as an
 * own property — Jest's VM module static link check fails with SyntaxError.
 *
 * Fix: replace `createMockModule(mockVar)` with `createNamedMockModule('exportName', mockVar)`
 * for each affected service path.
 *
 * Also fixes `({ default: svc } = await import(path))` assignment-form imports
 * in test files that directly import a converted service.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_SRC = resolve(__dirname, '../server/src');
const TESTS_DIR = join(SERVER_SRC, '__tests__');

// ---------------------------------------------------------------------------
// Step 1: Build export name map by scanning service/utils source files
// ---------------------------------------------------------------------------

function getExportName(filePath) {
  try {
    const src = readFileSync(filePath, 'utf8');
    // Match: export const <name> = new <Class>() or export const <name> = createX(...)
    const singletonMatch = src.match(/^export const ([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:new\s+\w|\w+\()/m);
    if (singletonMatch) return singletonMatch[1];
    // Match: export const <name> = { ... } (object literal)
    const objMatch = src.match(/^export const ([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*\{/m);
    if (objMatch) return objMatch[1];
    // Match: export const <name> = createClassificationRuntime(...) or similar
    const funcCallMatch = src.match(/^export const ([A-Za-z_$][A-Za-z0-9_$]*)\s*=/m);
    if (funcCallMatch) return funcCallMatch[1];
    return null;
  } catch {
    return null;
  }
}

// Build map: basename (no ext) -> { exportName, absolutePath }
const EXPORT_MAP = new Map();

function scanDir(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      scanDir(full);
    } else if (entry.endsWith('.mjs') && !entry.startsWith('__')) {
      const exportName = getExportName(full);
      if (exportName) {
        const key = basename(entry, '.mjs');
        // Don't overwrite if multiple files have the same basename
        if (!EXPORT_MAP.has(key)) {
          EXPORT_MAP.set(key, { exportName, absolutePath: full });
        }
      }
    }
  }
}

scanDir(join(SERVER_SRC, 'services'));
scanDir(join(SERVER_SRC, 'utils'));
scanDir(join(SERVER_SRC, 'routes'));
scanDir(join(SERVER_SRC, 'config'));
scanDir(join(SERVER_SRC, 'middleware'));
scanDir(join(SERVER_SRC, 'bootstrap'));

// ---------------------------------------------------------------------------
// Step 2: Fix test files
// ---------------------------------------------------------------------------

let totalFixed = 0;

function resolveServiceBasename(importPath) {
  // importPath like '../services/classification.mjs' or '../../services/tmdb.mjs'
  const base = basename(importPath, '.mjs');
  return base;
}

function fixTestFile(filePath) {
  let src = readFileSync(filePath, 'utf8');
  const original = src;

  // Fix createMockModule -> createNamedMockModule in jest.unstable_mockModule factories
  // Pattern: jest.unstable_mockModule('...path...', () => createMockModule(mockVar))
  // We need to handle both single-line and the case where createMockModule is on the same line as the path
  src = src.replace(
    /jest\.unstable_mockModule\((['"`])([^'"`)]+\.mjs)\1,\s*\(\)\s*=>\s*createMockModule\(/g,
    (match, quote, importPath) => {
      const serviceBase = resolveServiceBasename(importPath);
      const info = EXPORT_MAP.get(serviceBase);
      if (!info) return match; // Unknown service, leave as-is
      const { exportName } = info;
      return `jest.unstable_mockModule(${quote}${importPath}${quote}, () => createNamedMockModule('${exportName}', `;
    }
  );

  // Fix closing paren for the above: createMockModule(mockVar)) → createNamedMockModule('name', mockVar))
  // The above regex already handles opening. The closing paren is unchanged (already has the right number).
  // Actually, we need to ensure `createNamedMockModule` imports are available. Check if it's imported.
  if (src !== original && src.includes('createNamedMockModule') && !original.includes('createNamedMockModule')) {
    // Add createNamedMockModule to import if not already there
    src = src.replace(
      /import \{ createMockModule \} from '(.+?)'/,
      "import { createMockModule, createNamedMockModule } from '$1'"
    );
    src = src.replace(
      /import \{ createMockModule, createNamedMockModule \} from '(.+?)'/,
      "import { createMockModule, createNamedMockModule } from '$1'"
    );
  }

  // Fix assignment-form default imports: ({ default: svc } = await import(path))
  // for services that now export named singletons
  src = src.replace(
    /\(\{\s*default:\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\}\s*=\s*await import\((['"`])([^'"`)]+\.mjs)\2\)\)/g,
    (match, localName, quote, importPath) => {
      const serviceBase = resolveServiceBasename(importPath);
      const info = EXPORT_MAP.get(serviceBase);
      if (!info) return match;
      const { exportName } = info;
      if (exportName === localName) {
        return `({ ${exportName} } = await import(${quote}${importPath}${quote}))`;
      }
      return `({ ${exportName}: ${localName} } = await import(${quote}${importPath}${quote}))`;
    }
  );

  // Fix const-form default imports: const { default: svc } = await import(path)
  // for services that now export named singletons (only if NOT mocked — risky, skip for now)
  // These are handled separately since mocked modules still return default via createNamedMockModule

  if (src !== original) {
    writeFileSync(filePath, src, 'utf8');
    return true;
  }
  return false;
}

function walkTests(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkTests(full);
    } else if (entry.endsWith('.test.mjs') || entry.endsWith('.test.js') || full.includes('/setup/') || full.includes('/helpers/')) {
      if (fixTestFile(full)) {
        totalFixed++;
        console.log(`  fixed: ${full.replace(resolve(__dirname, '..') + '\\', '').replace(/\\/g, '/')}`);
      }
    }
  }
}

console.log('Scanning export map...');
console.log(`  Found ${EXPORT_MAP.size} service exports`);
console.log('');
console.log('Fixing test files...');
walkTests(TESTS_DIR);

console.log('');
console.log(`Done: ${totalFixed} files updated.`);
