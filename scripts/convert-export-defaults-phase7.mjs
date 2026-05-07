/**
 * Phase 7 ESM conversion: eliminate `export default` from source files,
 * convert to named exports, and update all consumer import statements.
 *
 * HANDLES:
 *  A) Route files — `const router = express.Router(); ... export default router;`
 *     → `export const router = express.Router();`
 *     Consumer: `import xRouter from './x.mjs'` → `import { router as xRouter } from './x.mjs'`
 *
 *  B) Singleton variables — `const svc = new X(); export default svc;`
 *     → `export const svc = new X();`
 *     Consumer: `import svc from './svc.mjs'` → `import { svc } from './svc.mjs'`
 *
 *  C) Singleton constructor — `export default new X();`
 *     → `export const x = new X();` (x = camelCase of X)
 *     Consumer: `import x from './x.mjs'` → `import { x } from './x.mjs'`
 *
 *  D) Variable alias — `const x = whatever; export default x;`
 *     → `export const x = whatever;`
 *
 *  E) Plain object wrapper — `const helpers = { fn1, fn2 }; export default helpers;`
 *     where functions are already exported → removes dead wrapper + default
 *
 * CONSUMER UPDATES (all source + test files):
 *  - `import X from './path'`          → `import { exportName as X } from './path'` (or `import { exportName }` if names match)
 *  - `import X from '...path'` (relative resolution)
 *  - `const { default: X } = await import('./path')` → `const { exportName: X } = await import('./path')`
 *  - `const { default: X, ... } = await import(...)` → `const { exportName: X, ... } = await import(...)`
 *  - mock: `() => ({ default: mockObj })` → `() => ({ exportName: mockObj })`
 *  - mock: `createMockModule(mockObj)` in files that import from converted module
 *    → `{ exportName: mockObj, ...mockObj }` (manual notice printed)
 *
 * SKIPS:
 *  - `export default function/class` (already fine as inline)
 *  - `export default {}` literal object (not a singleton)
 *  - Files under node_modules, __tests__ directory (tests are updated separately)
 *  - Router files that are consumed via app.use patterns (tracked but not broken)
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SERVER_SRC = join(ROOT, 'server', 'src');

const SKIP_DIRS = ['node_modules'];
const TEST_DIR = join(SERVER_SRC, '__tests__');

// ────────────────────────────────────────────────────────────────────────────
// Filesystem helpers
// ────────────────────────────────────────────────────────────────────────────

function walk(dir, results = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (SKIP_DIRS.includes(entry.name)) continue;
    if (entry.isDirectory()) walk(full, results);
    else if (entry.isFile() && entry.name.endsWith('.mjs')) results.push(full);
  }
  return results;
}

function rel(p) {
  return relative(ROOT, p).replace(/\\/g, '/');
}

// ────────────────────────────────────────────────────────────────────────────
// Source file analysis + transformation
// ────────────────────────────────────────────────────────────────────────────

/** camelCase a PascalCase class name: PolicyEngine → policyEngine */
function toCamel(s) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * Try to resolve a relative import path to an absolute file path.
 * Returns null if it cannot be resolved.
 */
function resolveImport(fromFile, importPath) {
  if (!importPath.startsWith('.')) return null;
  const base = join(dirname(fromFile), importPath);
  if (existsSync(base)) return base;
  if (existsSync(base + '.mjs')) return base + '.mjs';
  return null;
}

/**
 * Analyse a source file and determine what it exports as `export default`.
 * Returns { exportName, transform } or null.
 *
 * transform = 'route' | 'singleton-var' | 'singleton-ctor' | 'plain-var' | 'object-wrapper'
 */
function analyseExportDefault(filePath, content) {
  // Skip files with export default function/class (already inline)
  if (/^export default (?:function|class)\b/m.test(content)) return null;
  // Skip `export default { ... }` object literal (not a singleton)
  if (/^export default \{/.test(content.replace(/\n/g, ' '))) return null;
  // Skip migration runner and similar that we don't want to convert
  if (/^export default (?:function\*|async function\*)/m.test(content)) return null;

  // ── Pattern C: `export default new ClassName();`
  const ctorMatch = /^export default new ([A-Z][A-Za-z0-9_]*)(?:\(.*\))?;/m.exec(content);
  if (ctorMatch) {
    const className = ctorMatch[1];
    const exportName = toCamel(className);
    return { exportName, transform: 'singleton-ctor', ctorLine: ctorMatch[0], className };
  }

  // ── Pattern A/B/D: `export default varName;` at end of file
  const defMatch = /^export default ([A-Za-z_$][A-Za-z0-9_$]*);/m.exec(content);
  if (!defMatch) return null;
  const varName = defMatch[1];

  // Route file: varName is 'router' and file has `express.Router()`
  if (varName === 'router' && /express\.Router\(\)/.test(content)) {
    return { exportName: 'router', transform: 'route', varName };
  }

  // Plain object wrapper: `const varName = { fn1, fn2, ... }; export default varName;`
  // where the object body contains shorthand function refs that are already exported
  const wrapperRe = new RegExp(
    `^const ${varName}\\s*=\\s*\\{([^}]+)\\};?$`,
    'm',
  );
  const wrapperMatch = wrapperRe.exec(content);
  if (wrapperMatch) {
    // Check if all properties are already individually exported
    const bodyText = wrapperMatch[1];
    const propNames = bodyText
      .split(',')
      .map((p) => p.trim().split(':')[0].trim())
      .filter(Boolean)
      .filter((p) => !p.startsWith('//'));
    const alreadyExported = propNames.every((p) => {
      // Check for inline export of that name
      return new RegExp(`^export (?:async )?(?:function|const|class) ${p}\\b`, 'm').test(content);
    });
    if (alreadyExported) {
      return { exportName: varName, transform: 'object-wrapper', varName, wrapperMatch, propNames };
    }
    // If not all exported, treat as singleton-var anyway
  }

  // Singleton variable: `const varName = new X()` or `const varName = ...`
  return { exportName: varName, transform: 'singleton-var', varName };
}

/**
 * Transform the source file, returning the new content.
 * Returns null if no transformation needed.
 */
function transformSource(filePath, content, analysis) {
  const { exportName, transform, varName } = analysis;
  let result = content;

  if (transform === 'route') {
    // Add `export` before `const router = express.Router()`
    result = result.replace(
      /^(const router\s*=\s*(?:express\.Router|Router)\(\s*\);)/m,
      'export $1',
    );
    // Remove `export default router;`
    result = result.replace(/^export default router;\n?/m, '');
  } else if (transform === 'singleton-ctor') {
    const { ctorLine, className } = analysis;
    // Replace `export default new X()` with `export const x = new X()`
    const ctor = ctorLine.replace(/^export default /, `export const ${exportName} = `);
    result = result.replace(ctorLine, ctor);
  } else if (transform === 'singleton-var') {
    // Add `export` to the const/let/var declaration of varName
    // Try: `const varName = ` or `let varName = ` etc.
    const declRe = new RegExp(`^(const|let|var)(\\s+${escRe(varName)}\\s*=)`, 'm');
    if (declRe.test(result)) {
      result = result.replace(declRe, 'export $1$2');
    } else {
      return null; // Can't find declaration, skip
    }
    // Remove the trailing `export default varName;`
    result = result.replace(new RegExp(`^export default ${escRe(varName)};\\n?`, 'm'), '');
  } else if (transform === 'object-wrapper') {
    // Remove the `const varName = { ... }` wrapper line(s)
    const wrapperText = analysis.wrapperMatch[0];
    result = result.replace(wrapperText, '');
    // Remove `export default varName;`
    result = result.replace(new RegExp(`^export default ${escRe(varName)};\\n?`, 'm'), '');
    // Clean up any double blank lines
    result = result.replace(/\n{3,}/g, '\n\n');
  } else if (transform === 'plain-var') {
    const declRe = new RegExp(`^(const|let|var)(\\s+${escRe(varName)}\\s*=)`, 'm');
    if (declRe.test(result)) {
      result = result.replace(declRe, 'export $1$2');
    }
    result = result.replace(new RegExp(`^export default ${escRe(varName)};\\n?`, 'm'), '');
  }

  // Clean trailing whitespace lines before EOF
  result = result.trimEnd() + '\n';
  return result === content ? null : result;
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ────────────────────────────────────────────────────────────────────────────
// Consumer updates
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build a lookup: absolute file path → exported name
 */
function buildExportMap(conversions) {
  const map = new Map(); // absPath → exportName
  for (const { filePath, exportName } of conversions) {
    map.set(filePath, exportName);
  }
  return map;
}

/**
 * Given a consumer file and the export map, update its import statements.
 * Returns new content or null if unchanged.
 */
function updateConsumer(filePath, content, exportMap) {
  let result = content;

  for (const [srcPath, exportName] of exportMap) {
    result = updateImportsForModule(filePath, result, srcPath, exportName);
  }

  return result !== content ? result : null;
}

function updateImportsForModule(consumerPath, content, srcPath, exportName) {
  let result = content;

  // Build a set of relative paths this consumer might use to refer to srcPath
  const relPath = relative(dirname(consumerPath), srcPath).replace(/\\/g, '/');
  const relPathNoExt = relPath.replace(/\.mjs$/, '');
  // Also handle paths without leading ./
  const aliases = new Set([
    relPath,
    relPathNoExt,
    relPath.startsWith('./') ? relPath : './' + relPath,
    relPathNoExt.startsWith('./') ? relPathNoExt : './' + relPathNoExt,
  ]);

  for (const pathAlias of aliases) {
    const escaped = escRe(pathAlias);

    // ── Static default import: `import X from 'path'`
    // → `import { exportName as X } from 'path'` or `import { exportName } from 'path'`
    const staticDefault = new RegExp(
      `^import ([A-Za-z_$][A-Za-z0-9_$]*) from (['"])${escaped}\\2`,
      'gm',
    );
    result = result.replace(staticDefault, (match, localName, q) => {
      if (localName === exportName) {
        return `import { ${exportName} } from ${q}${pathAlias}${q}`;
      }
      return `import { ${exportName} as ${localName} } from ${q}${pathAlias}${q}`;
    });

    // ── Static default + named: `import X, { named } from 'path'`
    const staticDefaultNamed = new RegExp(
      `^import ([A-Za-z_$][A-Za-z0-9_$]*)\\s*,\\s*(\\{[^}]+\\}) from (['"])${escaped}\\3`,
      'gm',
    );
    result = result.replace(staticDefaultNamed, (match, localName, namedPart, q) => {
      const namedInner = namedPart.slice(1, -1).trim();
      if (localName === exportName) {
        return `import { ${exportName}, ${namedInner} } from ${q}${pathAlias}${q}`;
      }
      return `import { ${exportName} as ${localName}, ${namedInner} } from ${q}${pathAlias}${q}`;
    });

    // ── Dynamic default destructure: `const { default: X } = await import('path')`
    const dynDefault = new RegExp(
      `const \\{ default:\\s*([A-Za-z_$][A-Za-z0-9_$]*)(,\\s*[^}]*)? \\} = await import\\((['"])${escaped}\\3\\)`,
      'g',
    );
    result = result.replace(dynDefault, (match, localName, rest, q) => {
      const restPart = rest ? rest : '';
      if (localName === exportName) {
        return `const { ${exportName}${restPart} } = await import(${q}${pathAlias}${q})`;
      }
      return `const { ${exportName}: ${localName}${restPart} } = await import(${q}${pathAlias}${q})`;
    });

    // ── Dynamic default destructure alternate spacing: `const {default: X} = await import('path')`
    const dynDefault2 = new RegExp(
      `const \\{\\s*default:\\s*([A-Za-z_$][A-Za-z0-9_$]*)(,\\s*[^}]*)? *\\} = await import\\((['"])${escaped}\\3\\)`,
      'g',
    );
    result = result.replace(dynDefault2, (match, localName, rest, q) => {
      const restPart = rest ? rest : '';
      if (localName === exportName) {
        return `const { ${exportName}${restPart} } = await import(${q}${pathAlias}${q})`;
      }
      return `const { ${exportName}: ${localName}${restPart} } = await import(${q}${pathAlias}${q})`;
    });

    // ── Mock: `() => ({ default: X })` → `() => ({ exportName: X })`
    const mockDefault = new RegExp(
      `\\(\\) => \\(\\{ default: ([A-Za-z_$][A-Za-z0-9_$]*) \\}\\)`,
      'g',
    );
    // Only apply if this file imports from the relevant path
    if (new RegExp(escaped).test(result)) {
      result = result.replace(mockDefault, (match, mockVar) => {
        return `() => ({ ${exportName}: ${mockVar} })`;
      });
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

const allFiles = walk(SERVER_SRC);
const sourceFiles = allFiles.filter((f) => !f.includes('__tests__'));
const allFilesIncTests = allFiles;

// Phase 1: Find and transform source files
const conversions = []; // { filePath, exportName, transform }
let sourceChanged = 0;

console.log('\n── Phase 1: Converting source files ──\n');

// Files to explicitly skip (have custom patterns we don't want to auto-convert)
const SKIP_FILES = new Set([
  'migrations.mjs',       // migration runner
  'swaggerSpec.mjs',      // export default function
  'circuitBreaker.mjs',   // exports the class itself
  'providerIds.mjs',      // exports plain object namespace
  'url.mjs',              // exports plain object namespace (mediaServers/shared)
  'createEmbyLikeService.mjs', // factory function, not singleton
]);

for (const filePath of sourceFiles) {
  if (SKIP_FILES.has(basename(filePath))) continue;

  const content = readFileSync(filePath, 'utf8');
  const analysis = analyseExportDefault(filePath, content);
  if (!analysis) continue;

  const newContent = transformSource(filePath, content, analysis);
  if (!newContent) continue;

  writeFileSync(filePath, newContent, 'utf8');
  conversions.push({ filePath, exportName: analysis.exportName, transform: analysis.transform });
  sourceChanged++;
  console.log(`  [${analysis.transform}] ${rel(filePath)} → export const ${analysis.exportName}`);
}

console.log(`\nPhase 1 done: ${sourceChanged} source files converted.\n`);

// Phase 2: Update consumers (source + test files)
console.log('── Phase 2: Updating consumer import statements ──\n');

const exportMap = buildExportMap(conversions);
let consumerChanged = 0;

for (const filePath of allFilesIncTests) {
  const content = readFileSync(filePath, 'utf8');
  const newContent = updateConsumer(filePath, content, exportMap);
  if (newContent) {
    writeFileSync(filePath, newContent, 'utf8');
    consumerChanged++;
    console.log(`  updated ${rel(filePath)}`);
  }
}

console.log(`\nPhase 2 done: ${consumerChanged} consumer files updated.\n`);

// Phase 3: Summary
console.log('── Summary ──\n');
const byTransform = {};
for (const { transform } of conversions) {
  byTransform[transform] = (byTransform[transform] || 0) + 1;
}
for (const [t, n] of Object.entries(byTransform)) {
  console.log(`  ${t}: ${n} files`);
}
console.log(`\nTotal: ${sourceChanged} source + ${consumerChanged} consumer files.`);
console.log('\nNote: Review createMockModule() usages in test files — some may need');
console.log('      manual conversion from createMockModule(obj) → { svcName: obj, ...obj }');
